import { test, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { setupServer } from 'msw/node';
import { Anthropic, AnthropicClient } from "../src/anthropic/client";
import { ConfigLoader } from "../src/anthropic/config";
import { anthropicHandlers, mockMessageResponse, mockFileResponse } from "./__mocks__/anthropic";
import * as fs from 'node:fs';
import * as path from 'node:path';

// Setup MSW server
const server = setupServer(...anthropicHandlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// Test configuration loading
test("ConfigLoader loads TOML configuration", () => {
  const config = ConfigLoader.loadFromToml('./config.toml');
  expect(config.model).toBe('claude-sonnet-4-20250514');
  expect(config.max_tokens).toBe(4096);
  expect(config.base_url).toBe('https://api.anthropic.com/v1/');
  expect(config.timeout).toBe(60000);
});

test("ConfigLoader expands environment variables", () => {
  // Set test environment variable
  process.env.TEST_API_KEY = 'test-key-123';
  
  // Create temporary config file
  const testConfigPath = './test-config.toml';
  fs.writeFileSync(testConfigPath, 'api_key = "${TEST_API_KEY}"');
  
  try {
    const config = ConfigLoader.loadFromToml(testConfigPath);
    expect(config.api_key).toBe('test-key-123');
  } finally {
    fs.unlinkSync(testConfigPath);
    delete process.env.TEST_API_KEY;
  }
});

test("ConfigLoader applies environment variable overrides", () => {
  // Set environment overrides
  process.env.ANTHROPIC_API_KEY = 'env-override-key';
  process.env.ANTHROPIC_MODEL = 'claude-3-5-sonnet-20241022';
  process.env.ANTHROPIC_MAX_TOKENS = '2048';
  
  try {
    const config = ConfigLoader.loadWithEnvOverrides('./config.toml');
    expect(config.api_key).toBe('env-override-key');
    expect(config.model).toBe('claude-3-5-sonnet-20241022');
    expect(config.max_tokens).toBe(2048);
  } finally {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.ANTHROPIC_MAX_TOKENS;
  }
});

// Test client builder
test("AnthropicClientBuilder builds client with defaults", () => {
  // Set required env var for test
  process.env.ANTHROPIC_API_KEY = 'test-key';
  
  try {
    const client = Anthropic.client()
      .withDefaults()
      .withEnv()
      .build();
    
    expect(client).toBeInstanceOf(AnthropicClient);
    expect(client.getConfig().api_key).toBe('test-key');
    expect(client.getConfig().model).toBe('claude-sonnet-4-20250514');
  } finally {
    delete process.env.ANTHROPIC_API_KEY;
  }
});

test("AnthropicClientBuilder applies builder methods", () => {
  const client = Anthropic.client()
    .apiKey('builder-key')
    .model('claude-3-5-sonnet-20241022')
    .maxTokens(2048)
    .baseUrl('https://test.api.com/')
    .timeout(30000)
    .build();
  
  const config = client.getConfig();
  expect(config.api_key).toBe('builder-key');
  expect(config.model).toBe('claude-3-5-sonnet-20241022');
  expect(config.max_tokens).toBe(2048);
  expect(config.base_url).toBe('https://test.api.com/');
  expect(config.timeout).toBe(30000);
});

test("AnthropicClientBuilder throws error for missing required fields", () => {
  expect(() => {
    Anthropic.client().build();
  }).toThrow('API key is required');
  
  expect(() => {
    Anthropic.client().apiKey('test').build();
  }).toThrow('Model is required');
});

// Test client functionality with mocks
test("AnthropicClient creates messages successfully", async () => {
  const client = Anthropic.client()
    .apiKey('test-key')
    .model('claude-sonnet-4-20250514')
    .maxTokens(4096)
    .baseUrl('http://localhost:3000/v1/')
    .timeout(60000)
    .build();
  
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    messages: [
      { role: 'user', content: 'Hello, Claude!' }
    ]
  });
  
  expect(response.id).toBe('msg_01ABC123');
  expect(response.content[0]).toEqual({
    type: 'text',
    text: 'Hello! This is a mock response from Claude.',
    citations: null
  });
  expect(response.usage.input_tokens).toBe(10);
  expect(response.usage.output_tokens).toBe(25);
});

test("AnthropicClient handles streaming messages", async () => {
  const client = Anthropic.client()
    .apiKey('test-key')
    .model('claude-sonnet-4-20250514')
    .maxTokens(4096)
    .baseUrl('http://localhost:3000/v1/')
    .timeout(60000)
    .build();
  
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    messages: [
      { role: 'user', content: 'Hello, Claude!' }
    ]
  });
  
  const events: any[] = [];
  for await (const event of stream) {
    events.push(event);
  }
  
  expect(events.length).toBeGreaterThan(0);
  expect(events[0].type).toBe('message_start');
});

// Note: Files API not available in current SDK version
test.skip("AnthropicClient uploads files successfully", async () => {
  // This test is skipped as files API is not available in the current SDK version
});

// Test error handling
test("AnthropicClient handles API errors", async () => {
  const client = Anthropic.client()
    .apiKey('test-key')
    .model('claude-sonnet-4-20250514')
    .maxTokens(4096)
    .baseUrl('http://localhost:3000/v1/')
    .timeout(60000)
    .build();
  
  try {
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10000, // This will trigger our mock error
      messages: [
        { role: 'user', content: 'Hello, Claude!' }
      ]
    });
    expect(false).toBe(true); // Should not reach here
  } catch (error: any) {
    expect(error.status).toBe(400);
  }
});

test("AnthropicClient handles authentication errors", async () => {
  const client = Anthropic.client()
    .apiKey('invalid-key') // Use invalid key to trigger auth error
    .model('claude-sonnet-4-20250514')
    .maxTokens(4096)
    .baseUrl('http://localhost:3000/v1/')
    .timeout(60000)
    .build();
  
  try {
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [
        { role: 'user', content: 'Hello, Claude!' }
      ]
    });
    expect(false).toBe(true); // Should not reach here
  } catch (error: any) {
    expect(error.status).toBe(401);
  }
});

test("AnthropicClient handles rate limiting", async () => {
  const client = Anthropic.client()
    .apiKey('test-key')
    .model('rate-limited-model') // Use special model name to trigger rate limit
    .maxTokens(4096)
    .baseUrl('http://localhost:3000/v1/')
    .timeout(60000)
    .build();
  
  try {
    await client.messages.create({
      model: 'rate-limited-model',
      max_tokens: 100,
      messages: [
        { role: 'user', content: 'Hello, Claude!' }
      ]
    });
    expect(false).toBe(true); // Should not reach here
  } catch (error: any) {
    expect(error.status).toBe(429);
  }
});

test("AnthropicClient handles server errors", async () => {
  const client = Anthropic.client()
    .apiKey('server-error-key') // Use special key to trigger server error
    .model('claude-sonnet-4-20250514')
    .maxTokens(4096)
    .baseUrl('http://localhost:3000/v1/')
    .timeout(60000)
    .build();
  
  try {
    await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [
        { role: 'user', content: 'Hello, Claude!' }
      ]
    });
    expect(false).toBe(true); // Should not reach here
  } catch (error: any) {
    expect(error.status).toBe(500);
  }
});