First-Step Plan (TS-only, Bun, Azurite)

- [ ] Ensure Azurite is running (Docker) and reachable via health check.
- [ ] Add minimal TS client sketch exposing ensureAppendBlob, append, readAll.
- [ ] Add Bun-based test for Azurite health endpoint.
- [ ] Add Bun-based append test: write "Hello", read; append "World", read.
- [ ] Ensure tests use unique container/blob names and clean up.
- [ ] Provide `justfile` with clean, test, package.
- [ ] Document usage and setup in AGENTS.md.

Stop here. Do not add more APIs, mocks, or other languages yet.

