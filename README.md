# Workspace

A Bun project with automated CI/CD testing.

## Installation

To install dependencies:

```bash
bun install
```

## Usage

To run the main application:

```bash
bun run index.ts
```

To run tests:

```bash
bun test
```

To run tests with coverage:

```bash
bun test --coverage
```

## CI/CD

This project includes a GitHub Actions workflow that automatically runs tests on every pull request to the `main` branch. The CI pipeline includes:

- **Dependency Installation**: Installs all project dependencies using `bun install --frozen-lockfile`
- **Type Checking**: Validates TypeScript types using `tsc --noEmit`
- **Testing**: Runs all tests using `bun test`
- **Coverage**: Generates test coverage reports (optional, non-blocking)

The workflow is defined in `.github/workflows/ci.yml` and will run automatically when:
- A pull request is opened targeting the `main` branch
- Commits are pushed to the `main` branch

## Development

This project was created using `bun init` in bun v1.2.21. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
