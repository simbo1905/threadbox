**Agent Overview**

- **Goal:** Minimal, client-side TypeScript wrapper that exposes only append and read operations against Azure Append Blobs, with tests that run locally against Azurite. Keep steps tiny; no server code, no polyglot yet.
- **Scope (first step only):**
  - TS client sketch with minimal API shape (ensureAppendBlob, append, readAll).
  - Bun-based tests that verify basic behavior against Azurite: write "Hello", read; append "World", read.
  - No packaging beyond a simple build; no Python; no AWS/GCP shims; no extra deps.

**Why Azure first**

- Azure Append Blob natively supports append semantics. Azurite provides a fast local dev endpoint with a well-known connection string.
- TS tests use `@azure/storage-blob` (AppendBlobClient) to interact with Azurite. Our client is a thin pass-through, preserving Azure semantics.

**Prerequisites**

- Tools managed via `mise` per‑project (no global installs):
  - `bun` (runtime, test runner, bundler)
  - `just` (task runner)
  - `docker` (or `colima`+`docker`) to run Azurite

Using mise without the global flag (sandboxed to this repo):

```
# inside the repo root
mise use bun latest
mise use just latest

# teammates just run:
mise install    # reads mise.toml and installs pinned tools locally
```

What happens:
1) `mise` installs requested versions if missing (cached in mise dirs).
2) It creates/updates `mise.toml` in this repo (no host‑global config changes).
3) When you `cd` into this folder, shims activate; outside the repo, your globals remain untouched.

If you use Homebrew instead: `brew install bun just colima docker`.

**Running Azurite (local dev)**

1) Start Docker VM (if using Colima):
```
colima start --mount-type virtiofs
```

2) Run Azurite (Blob service on 10000):
```
docker run -d -p 10000:10000 mcr.microsoft.com/azure-storage/azurite
```

3) Verify container running:
```
docker ps | grep azurite
```

4) Health check (expect HTTP response from Azurite; status may be 200 or 401 depending on auth):
```
curl -i "http://127.0.0.1:10000/devstoreaccount1?comp=list"
```

5) Connection string for tests (well-known):
```
AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true
```

Alternatively (expanded form):
```
DefaultEndpointsProtocol=http;AccountName=devstoreaccount1; \
AccountKey=Eby8vdM02xNOcqFe.....xlRTb33V2; \
BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;
```

**Project Layout (first step)**

- `src/index.ts` → Minimal TS client sketch using `@azure/storage-blob` AppendBlobClient.
- `tests/azurite.health.test.ts` → Verifies Azurite responds on 10000.
- `tests/append.azurite.test.ts` → Creates container + append blob, appends "Hello" then "World" and reads back.
- `justfile` → Tiny workflow: `clean`, `test`, `package`.
- `PLAN.md` → Checkbox list of baby steps; only goes as far as the first append/read test.

CRITICAL: There must be no scripts in the `package.json` as this is a polyglot project and `just` and `justfile` must be the ONLY self documenting just file.
**Justfile Workflow**

- `just test` → Runs Bun tests. Set `AZURE_STORAGE_CONNECTION_STRING` to `UseDevelopmentStorage=true` for local Azurite.
- `just package` → Bundles the client to `dist/` using Bun (ESM output).
- `just clean` → Removes `dist/` and coverage artifacts.

**Minimal Client API (sketch)**

- `ensureAppendBlob(container, blob): Promise<void>`
- `append(container, blob, data: Uint8Array | Buffer | string): Promise<void>`
- `readAll(container, blob): Promise<Uint8Array>`

Semantics intentionally mirror Azure Append Blob headers/behavior. Errors from Azure SDK are not translated.

**Test Notes**

- Tests create unique container/blob names and clean up after themselves even on failure.
- Health test performs an HTTP GET to `http://127.0.0.1:10000/devstoreaccount1?comp=list` to assert Azurite is reachable.
- Append test uses `AppendBlobClient.createIfNotExists()`, `appendBlock()`, and `downloadToBuffer()` to validate round-trip content.

**How to Run**

0) Install per-project tools:
```
mise install
```

1) Ensure Azurite is running and reachable (see above health check).
2) Export connection string:
```
export AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true
```
3) Run tests:
```
just test
```

4) Build the minimal client bundle (optional at this step):
```
just package
```

**Next (not in this step)**

- Add `readRange(start, end?)`.
- Write a tiny in-memory mock that implements the same minimal API for local-only unit tests (in addition to Azurite tests).
- Introduce Python client parity with `uv` and `mise` toolchain.
- Wire AWS/GCP shims that emulate Azure Append Blob semantics over S3/GCS.

## Debugging with Bun + VS Code

Bun’s runtime exposes a WebKit-Inspector debugger compatible with VS Code (via the Bun extension) and a web debugger at `debug.bun.sh`.

### Prereqs
- Bun ≥ 1.x (`bun --version`)
- VS Code “Bun for Visual Studio Code” extension
- `"sourceMap": true` in `tsconfig.json` (already set)

### Just commands
- All tests, wait for attach
  ```bash
  just debug-tests
  ```

- Single test file
  ```bash
  just debug-tests-file tests/append.azurite.test.ts
  ```

Both commands start `bun test` with `--inspect-wait=6499`, pausing until the debugger attaches.

### VS Code
1. Use the "Attach: Bun tests (port 6499)" config to attach.
2. Set breakpoints in .ts files; run continues on attach.

Tip: If attach is flaky on your platform, open the web debugger by running `bun test --inspect=6499` and following the printed debug.bun.sh link.

### Ports & alternatives
- Change the inspector port by editing the just recipes: e.g. `--inspect-wait=9230`.
- For “break on first line” instead of waiting for attach, replace with `--inspect-brk=PORT`.

## Running agent-dsl Transpilation and Validation

Use these commands to validate the typesafe DSL end-to-end:

Author check: just dsl-check-author examples/risk_pipe.ts
Transpile: just dsl-transpile examples/risk_pipe.ts ./.tmp/risk_pipe.gen.ts
Generated check: just dsl-check-generated ./.tmp/risk_pipe.gen.ts
Tests: just test (if Azurite isn’t running locally, use POC_AGENT_DSL=1 just test to run only the PoC tests)
