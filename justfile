set shell := ["bash", "-cu"]

# Default: list available recipes
default:
    @just --list

# Clean build/test artifacts
clean:
    rm -rf dist coverage .tsbuildinfo

# Run tests with Bun
test:
    bun install
    AZURE_STORAGE_CONNECTION_STRING=${AZURE_STORAGE_CONNECTION_STRING:-UseDevelopmentStorage=true} \
    bun test --timeout 20000

# Build minimal ESM bundle to dist/
package:
    bun build src/index.ts --outdir dist --format esm --target node

# Run only Anthropic client tests (mocked)
test-anthropic:
    npm install
    AZURE_STORAGE_CONNECTION_STRING=${AZURE_STORAGE_CONNECTION_STRING:-UseDevelopmentStorage=true} \
    bun test tests/anthropic-client.test.ts --timeout 20000

# Run Anthropic integration tests with real API (requires ANTHROPIC_API_KEY)
test-anthropic-integration:
    npm install
    ANTHROPIC_INTEGRATION_TESTS=true \
    AZURE_STORAGE_CONNECTION_STRING=${AZURE_STORAGE_CONNECTION_STRING:-UseDevelopmentStorage=true} \
    bun test tests/anthropic-integration.test.ts --timeout 30000

# --- Debugging ---

# Debug ALL tests: starts Bun’s inspector and waits for the debugger to attach
# Change 6499 if you prefer a different port.
debug-tests:
    bun install
    AZURE_STORAGE_CONNECTION_STRING=${AZURE_STORAGE_CONNECTION_STRING:-UseDevelopmentStorage=true} \
    bun test --inspect-wait=6499 --timeout 20000

# Debug a specific test file or pattern:
# usage: just debug-tests-file tests/append.azurite.test.ts
debug-tests-file *ARGS:
    bun install
    AZURE_STORAGE_CONNECTION_STRING=${AZURE_STORAGE_CONNECTION_STRING:-UseDevelopmentStorage=true} \
    bun test --inspect-wait=6499 --timeout 20000 {{ARGS}}

# --- DSL PoC commands (moved from package.json) ---

# Step 1: Author lint/typecheck
# usage: just dsl-check-author examples/risk_pipe.ts
dsl-check-author FILE:
    bun run src/agent-dsl/check.ts {{FILE}}

# Step 2: Transpile TS→TS
# usage: just dsl-transpile examples/risk_pipe.ts ./.tmp/risk_pipe.gen.ts
dsl-transpile IN OUT:
    bun run src/agent-dsl/transpile.ts {{IN}} --out {{OUT}}

# Step 3: Generated lint/typecheck
# usage: just dsl-check-generated ./.tmp/risk_pipe.gen.ts
dsl-check-generated FILE:
    bun run src/agent-dsl/check.ts {{FILE}}

# --- UUID Generator Tests ---

# Run only the id generator tests
test-id:
    bun install
    bun test tests/id/UuidGenerator.spec.ts --timeout=60000

# Heavy local soak (optional)
test-id-soak:
    bun install
    bun test tests/id/UuidGenerator.spec.ts --timeout=180000 --runInBand
