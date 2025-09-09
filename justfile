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
