## Running agent-dsl Transpilation and Validation

Author check: just dsl-check-author examples/risk_pipe.ts
Transpile: just dsl-transpile examples/risk_pipe.ts ./.tmp/risk_pipe.gen.ts
Generated check: just dsl-check-generated ./.tmp/risk_pipe.gen.ts
Tests: just test (if Azurite isn’t running locally, use POC_AGENT_DSL=1 just test to run only the PoC tests)

---

Commands (PoC workflow)

1) Author lint/typecheck

    just dsl-check-author examples/risk_pipe.ts

2) Transpile

    just dsl-transpile examples/risk_pipe.ts ./.tmp/risk_pipe.gen.ts

3) Generated lint/typecheck

    just dsl-check-generated ./.tmp/risk_pipe.gen.ts

4) Run unit tests

    just test

---
## Deep Dive: Architecture and Flow

```mermaid
flowchart LR
  A[Author DSL\nexamples/risk_pipe.ts] --> B[Transpiler\nsrc/agent-dsl/transpile.ts]
  B -->|emits TS| C[Generated main\n.tmp/risk_pipe.gen.ts]
  C -->|import types| D[Runtime facade\nsrc/runtime]
  C -->|uses| E[Ctx.tools mocks in tests]
  F[Typecheck script\nsrc/agent-dsl/check.ts] --> A
  F --> C
  G[Tests\ntests/agent-dsl.spec.ts] --> F
  G --> B
  G --> C
  D --> Rx[(RxJS)]
```

- The author DSL never runs the pipeline; it only describes it.
- The transpiler generates a real main(R, ctx) that calls runtime ops directly (no interpreter), then tests drive execution with mock Tools.

### Sequence (what actually happens)

```mermaid
sequenceDiagram
  participant Test as tests/agent-dsl.spec.ts
  participant Check as check.ts
  participant Trans as transpile.ts
  participant Gen as .tmp/risk_pipe.gen.ts
  participant Run as Runtime (Rx facade)
  participant Tools as Mock Tools (ctx.tools)

  Test->>Check: typecheck author (examples/risk_pipe.ts)
  Test->>Trans: bun run transpile.ts examples/risk_pipe.ts --out .tmp/...
  Trans->>Trans: import author build() to descriptor
  Trans->>Gen: write generated TS (direct R.* + ctx.tools.*)
  Test->>Check: typecheck generated (.tmp/...)
  Test->>Gen: import { main }
  Test->>Gen: main(Run, { tools, log })
  Gen->>Run: R.par([thunks])  // runShell, callApi(2x)
  Run->>Tools: runShell(...)
  Run->>Tools: callApi("download-documents")
  Run->>Tools: callApi("fetch-risk-seed")
  Run-->>Gen: join/forkJoin results
  Gen->>Run: R.flatMap(prev, v => ctx.tools.callApi("riskAssessment", payload), "concat")
  Run->>Tools: callApi("riskAssessment", {docs, seed})
  Gen->>Run: R.tap(v => ctx.log({label:"risk-assessed"}))
  Gen->>Run: R.retry(...), R.onError(...)
  Run-->>Test: Observable completes
```

(See assertions for ordering, logging, and retry in the tests.)

### Error flow (retry + recover)

```mermaid
sequenceDiagram
  participant Gen as generated main()
  participant Run as Runtime
  participant Tools as ctx.tools
  Note over Tools: riskAssessment fails twice, succeeds third time
  Gen->>Run: R.retry(stream,{max:3,backoffMs:500})
  Run->>Tools: callApi("riskAssessment")
  Tools-->>Run: throw Error
  Run->>Tools: retry attempt #2
  Tools-->>Run: throw Error
  Run->>Tools: retry attempt #3
  Tools-->>Run: ok
  Run-->>Gen: success (no recover)
```

(Validated by the second test: “retries on failure up to max…”.)

### Where to inject mistakes (and how to see them)

Structural error (transpile-time): make `andThen` return a non-alias.

```ts
// BEFORE
andThen(([logs, docs, seed]) => callApi("riskAssessment", { docs, seed })),

// AFTER (broken on purpose)
andThen(([logs, docs, seed]) => ({ hello: "world" } as any)),
```

Run: `just dsl-transpile examples/risk_pipe.ts ./.tmp/risk_pipe.gen.ts` → E_EMIT with loc.

Type error during generated typecheck: break alias name to mismatch Tools.

```ts
// BEFORE
// import { runShell, callApi } from "../src/actions"

// AFTER (broken on purpose)
// export const callApi = alias<...>("callAPI")
```

Run:

```bash
just dsl-transpile examples/risk_pipe.ts ./.tmp/risk_pipe.gen.ts
just dsl-check-generated ./.tmp/risk_pipe.gen.ts  # fails with TS error against Tools
```
