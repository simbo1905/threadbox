import { describe, it, expect } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import { lastValueFrom, of, delay, tap } from "rxjs";
import { RxRuntime } from "../src/runtime";

const TMP_OUT = resolve(".tmp/risk_pipe.gen.ts");

function typecheck(label: string, files: string[]) {
  const program = ts.createProgram({
    rootNames: files,
    options: {
      target: ts.ScriptTarget.ES2021,
      module: ts.ModuleKind.ES2020,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      baseUrl: ".",
      noEmit: true,
      allowImportingTsExtensions: true,
      paths: {
        "agent-dsl": ["src/agent-dsl/index.ts"],
      },
    },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  const errs = diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errs.length) {
    const msg = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => "\n",
    });
    throw new Error(`Typecheck failed (${label}):\n` + msg);
  }
}

describe("agent-dsl PoC", () => {
  it("transpiles, typechecks, runs with mocked tools (success path)", async () => {
    // Step 1: Author typecheck
    typecheck("author", [resolve("examples/risk_pipe.ts"), resolve("src/agent-dsl/index.ts")]);

    // Step 2: Transpile
    mkdirSync(resolve(".tmp"), { recursive: true });
    const proc = await Bun.$`bun run src/agent-dsl/transpile.ts examples/risk_pipe.ts --out ${TMP_OUT}`.quiet();
    expect(proc.exitCode).toBe(0);

    // Step 3: Generated typecheck
    typecheck("generated", [TMP_OUT, resolve("src/runtime/index.ts")]);

    // Step 4: Execute generated main using RxRuntime with mocked Tools
    const calls: { name: string; t: number; payload?: any }[] = [];
    const logs: any[] = [];

    const tools = {
      runShell: (cmd: string, _args?: string[]) => {
        calls.push({ name: "runShell", t: Date.now(), payload: { cmd } });
        return of(Buffer.from("ok"));
      },
      callApi: (name: string, payload?: unknown) => {
        calls.push({ name, t: Date.now(), payload });
        if (name === "download-documents") return of({ docs: 1 }).pipe(delay(5));
        if (name === "fetch-risk-seed") return of({ seed: 2 }).pipe(delay(5));
        if (name === "riskAssessment") {
          expect((payload as any).docs.docs).toBe(1);
          expect((payload as any).seed.seed).toBe(2);
          return of({ risk: "done" });
        }
        return of(null as any);
      },
      log: (input: any) => {
        logs.push(input);
        return of(void 0);
      },
    };

    const { main } = await import(TMP_OUT);
    const ctx = { tools, log: (x: unknown) => logs.push(x) };
    const out$ = await main(RxRuntime, ctx as any);
    await lastValueFrom(out$.pipe(tap(() => {})));

    // Assertions: ordering
    const tRun = calls.find((c) => c.name === "runShell")!.t;
    const tDocs = calls.find((c) => c.name === "download-documents")!.t;
    const tSeed = calls.find((c) => c.name === "fetch-risk-seed")!.t;
    const tAssess = calls.find((c) => c.name === "riskAssessment")!.t;
    expect(tAssess).toBeGreaterThanOrEqual(Math.max(tRun, tDocs, tSeed));

    // log("risk-assessed") occurred (label included)
    expect(logs.some((x) => typeof x === "object" && (x as any).label === "risk-assessed")).toBe(true);
  });

  it("retries on failure up to max and succeeds on third attempt", async () => {
    mkdirSync(resolve(".tmp"), { recursive: true });
    if (!existsSync(TMP_OUT)) {
      await Bun.$`bun run src/agent-dsl/transpile.ts examples/risk_pipe.ts --out ${TMP_OUT}`.quiet();
    }
    const { main } = await import(TMP_OUT);

    let riskAttempt = 0;
    const calls: string[] = [];
    const tools = {
      runShell: () => of(Buffer.from("ok")),
      callApi: (name: string, payload?: unknown) => {
        calls.push(name);
        if (name === "download-documents") return of({ docs: 1 });
        if (name === "fetch-risk-seed") return of({ seed: 2 });
        if (name === "riskAssessment") {
          riskAttempt++;
          if (riskAttempt < 3) {
            return of(null as any).pipe(tap(() => { throw new Error("fail"); }));
          }
          return of({ ok: true });
        }
        return of(null as any);
      },
      log: () => of(void 0),
    };

    const ctx = { tools, log: () => {} };
    const out$ = await main(RxRuntime, ctx as any);
    await lastValueFrom(out$);

    // Should have attempted riskAssessment at least 3 times
    expect(calls.filter((n) => n === "riskAssessment").length).toBeGreaterThanOrEqual(3);
  });
});
