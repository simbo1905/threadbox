# Anthropic Client Implementation

Note: This client is foundation work for future agent‑to‑agent communication and orchestration. It is not yet integrated with the DSL transpilation pipeline; today it serves as supporting infrastructure and integration surface area.

This implementation provides a simple TypeScript Anthropic client with TOML configuration support and comprehensive testing.

## Features

- ✅ **Simple Builder Pattern**: `Anthropic.client().withDefaults().model("claude-sonnet-4-20250514")`
- ✅ **TOML Configuration**: Load settings from `config.toml` with environment variable overrides
- ✅ **Core API Support**: Messages creation and streaming (Files API not available in current SDK version)
- ✅ **Comprehensive Testing**: Unit tests with MSW mocking + integration tests
- ✅ **Error Handling**: Proper handling of API errors (400, 401, 429, 500)
- ✅ **TypeScript Support**: Full type safety and IntelliSense

## Quick Start

### 1. Configuration

Create a `config.toml` file:

```toml
# config.toml
api_key = "${ANTHROPIC_API_KEY}"
model = "claude-sonnet-4-20250514"
max_tokens = 4096
base_url = "https://api.anthropic.com/v1/"
timeout = 60000
```

### 2. Environment Variables

Create a `.env` file (copy from `.env.example`):

```bash
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_INTEGRATION_TESTS=false  # Set to 'true' to run integration tests
```

### 3. Basic Usage

```typescript
import { Anthropic } from './src/anthropic/client';

// Using builder pattern with config file
const client = Anthropic.client()
  .withDefaults()  // Load from config.toml
  .withEnv()       // Apply environment overrides
  .build();

// Create a message
const response = await client.messages.create({
  model: 'claude-3-5-haiku-20241022',
  max_tokens: 100,
  messages: [
    { role: 'user', content: 'Hello, Claude!' }
  ]
});

// Stream a message
const stream = await client.messages.stream({
  model: 'claude-3-5-haiku-20241022',
  max_tokens: 100,
  messages: [
    { role: 'user', content: 'Count from 1 to 5' }
  ]
});

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    process.stdout.write(event.delta.text);
  }
}
```

## Testing

### Run Mock Tests
```bash
# Using npm (since just is not available in this environment)
npm install
AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true bun test tests/anthropic-client.test.ts
```

### Run Integration Tests
```bash
# Set environment variables first
export ANTHROPIC_API_KEY=your_key_here
export ANTHROPIC_INTEGRATION_TESTS=true

# Run integration tests
bun test tests/anthropic-integration.test.ts
```

## Implementation Details

### File Structure
```
src/anthropic/
├── client.ts      # Main client and builder classes
├── config.ts      # TOML configuration loader
└── index.ts       # Public exports

tests/
├── anthropic-client.test.ts      # Unit tests with mocks
├── anthropic-integration.test.ts # Integration tests with real API
└── __mocks__/
    └── anthropic.ts              # MSW mock handlers
```

### Key Classes

- **`AnthropicClient`**: Main client wrapper around the official SDK
- **`AnthropicClientBuilder`**: Builder pattern for client configuration
- **`ConfigLoader`**: TOML configuration file loader with env var support

### Testing Strategy

1. **Unit Tests**: Use MSW to mock HTTP responses, test all functionality
2. **Integration Tests**: Optional real API tests, toggled by environment variables
3. **Error Handling**: Test various error conditions (400, 401, 429, 500)
4. **Streaming**: Test both regular and streaming message creation

## Limitations

- Files API not available in current Anthropic SDK version (tests are skipped)
- Some tests may be slow due to SDK retry logic on error conditions

## Dependencies Added

- `@anthropic-ai/sdk`: Official Anthropic SDK
- `msw`: API mocking for tests
- `@types/node`: Node.js type definitions
- `toml`: TOML configuration file parsing
