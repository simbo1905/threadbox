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
