# Getting Started with agent-dsl

## Quick Setup

### TypeScript/JavaScript

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run examples
npm run example
```

### Python

```bash
# Install Python dependencies
cd python
pip install -r requirements.txt

# Install the package in development mode
pip install -e .

# Run Python examples
python examples/basic_python.py
python examples/json_pipeline.py
```

## Basic Usage

### TypeScript

```typescript
import { AgentDSL } from 'agent-dsl';

const dsl = new AgentDSL();

// Define a pipeline
const source = `
  input: string
  
  step1 = map(input, x => "Hello " + x)
  step2 = callApi("/echo", { message: step1 })
  
  output: step2
`;

// Compile and run
const pipeline = dsl.compileSource(source);
pipeline.run({ input: "World" }).subscribe(result => {
  console.log(result); // { output: { status: 200, data: { message: "Hello World" } } }
});
```

### Python

```python
from agent_dsl import RxPyRuntime
from agent_dsl.types import *

# Create pipeline programmatically
pipeline = IRPipeline(
    inputs=[IRInput(name="text", type=IRType.STRING)],
    steps=[
        IRStep(name="process", expression=IRTool(
            id="1", type="tool", tool_name="callApi",
            config={"url": "/process"},
            input_type=IRType.STRING, output_type=IRType.OBJECT
        ))
    ],
    outputs=[IROutput(name="result", step_name="process", type=IRType.OBJECT)]
)

# Execute
runtime = RxPyRuntime()
compiled = runtime.compile(pipeline)
compiled.run({"text": "Hello"}).subscribe(print)
```

## DSL Syntax

The agent-dsl uses a minimal "baby TypeScript" syntax:

### Input/Output Declarations
```
input: type
output: stepName
```

### Step Definitions
```
stepName = operation(args...)
stepName = toolCall(config...)
```

### Supported Operations

- **map(input, fn)** - Transform values
- **flatMap(input, fn)** - Transform and flatten
- **filter(input, predicate)** - Filter values
- **zip(left, right)** - Combine two streams
- **onError(input, handler)** - Error handling

### Supported Tools

- **callApi(url, config)** - HTTP API calls
- **runShell(command, config)** - Shell commands
- **useMCP(service, config)** - Model Context Protocol
- **readFile(path, config)** - File reading
- **writeFile(path, config)** - File writing

## Architecture

```
DSL Source Code
       ↓
   Parser (Lexer + Parser)
       ↓
   IR (Intermediate Representation)
       ↓ 
   Validation (Zod schemas + semantic validation)
       ↓
   Compilation (TypeScript: RxJS, Python: RxPY)
       ↓
   Execution (Reactive streams)
```

## Project Structure

```
agent-dsl/
├── src/                    # TypeScript source
│   ├── ir/                # Intermediate Representation
│   ├── parser/            # Lexer and Parser  
│   ├── runtime/           # RxJS backend
│   ├── schemas/           # Zod validation
│   └── index.ts           # Main API
├── python/                # Python runtime
│   ├── agent_dsl/         # Python package
│   └── examples/          # Python examples
├── examples/              # TypeScript examples
└── dist/                  # Compiled output
```

## Next Steps

1. **Extend the parser** - Add support for more complex syntax (functions, conditionals, loops)
2. **Add more tools** - Implement real HTTP, file system, and MCP integrations
3. **Improve type inference** - Better static analysis and type checking
4. **Add debugging** - Runtime inspection and step-by-step execution
5. **Performance optimization** - Parallel execution and caching

## Contributing

This is a prototype implementation. Key areas for improvement:

- **Parser**: Currently handles basic syntax, needs function expressions, complex types
- **Type system**: Basic type checking, needs generics and inference
- **Runtime**: Mock tools, needs real implementations
- **Error handling**: Basic error reporting, needs better diagnostics
- **Testing**: Minimal tests, needs comprehensive test suite

The goal is to provide a foundation for building sophisticated agentic pipelines with type safety and reactive execution.