# agent-dsl

A minimal, typesafe DSL for agentic reactive pipelines.

## Overview

agent-dsl is a "baby TypeScript" embedded DSL for describing data/agent processing pipelines that compile to typesafe reactive programs. It provides:

- **Minimal program model**: Graph of steps with sequencing and fan-out/fan-in
- **Typed operation set**: map, flatMap, zip, onError with aliasable macros
- **Validation contract**: Syntax + schema validation with line/column errors
- **Mechanical lowering**: Compiles to Reactive Runtime API (RxJS, Effekt, callbags, etc.)
- **Python adapter**: Cross-language compatibility with RxPY

## Quick Start

```bash
npm install
npm run build
npm run example
```

## Project Structure

```
src/
├── parser/          # DSL parser and lexer
├── schemas/         # Zod validation schemas
├── ir/              # Intermediate Representation types
├── runtime/         # RxJS backend implementation
└── index.ts         # Main exports

python/              # Python RxPY runner
examples/            # Example DSL programs
```

## Example DSL Program

```typescript
// Define a simple agent pipeline
const pipeline = dsl`
  input: string
  
  step1 = map(input, x => x.toUpperCase())
  step2 = flatMap(step1, x => callApi("/process", { text: x }))
  step3 = onError(step2, err => "fallback")
  
  output: step3
`;

// Compile and run
const reactive = compile(pipeline);
reactive.run("hello world");
```

## Development

- `npm run dev` - Watch mode compilation
- `npm test` - Run tests
- `npm run lint` - Lint code