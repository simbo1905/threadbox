import { test, expect, beforeAll } from "bun:test";
import { Anthropic } from "../src/anthropic/client";

// Integration tests that use the real Anthropic API
// These are skipped unless ANTHROPIC_INTEGRATION_TESTS=true and ANTHROPIC_API_KEY is set

const SKIP_INTEGRATION = process.env.ANTHROPIC_INTEGRATION_TESTS !== 'true' || !process.env.ANTHROPIC_API_KEY;

function skipIfNoIntegration(testName: string, testFn: () => Promise<void>) {
  if (SKIP_INTEGRATION) {
    test.skip(`${testName} (integration test skipped - set ANTHROPIC_INTEGRATION_TESTS=true and ANTHROPIC_API_KEY to run)`, testFn);
  } else {
    test(testName, testFn);
  }
}

beforeAll(() => {
  if (!SKIP_INTEGRATION) {
    console.log('Running Anthropic integration tests with real API...');
  }
});

skipIfNoIntegration("Integration: Create simple message with real API", async () => {
  const client = Anthropic.client()
    .withDefaults()
    .withEnv()
    .build();
  
  const response = await client.messages.create({
    model: 'claude-3-5-haiku-20241022', // Use cheaper model for testing
    max_tokens: 50,
    messages: [
      { role: 'user', content: 'Say "Hello, integration test!" and nothing else.' }
    ]
  });
  
  expect(response.id).toBeDefined();
  expect(response.content).toBeDefined();
  expect(response.content.length).toBeGreaterThan(0);
  expect(response.content[0].type).toBe('text');
  expect(response.usage.input_tokens).toBeGreaterThan(0);
  expect(response.usage.output_tokens).toBeGreaterThan(0);
  
  console.log('Integration test response:', response.content[0]);
});

skipIfNoIntegration("Integration: Stream message with real API", async () => {
  const client = Anthropic.client()
    .withDefaults()
    .withEnv()
    .build();
  
  const stream = await client.messages.stream({
    model: 'claude-3-5-haiku-20241022', // Use cheaper model for testing
    max_tokens: 50,
    messages: [
      { role: 'user', content: 'Count from 1 to 5, one number per line.' }
    ]
  });
  
  let messageContent = '';
  let eventCount = 0;
  
  for await (const event of stream) {
    eventCount++;
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      messageContent += event.delta.text;
    }
  }
  
  expect(eventCount).toBeGreaterThan(0);
  expect(messageContent.length).toBeGreaterThan(0);
  
  console.log('Integration streaming response:', messageContent);
});

// Note: Files API not available in current SDK version
test.skip("Integration: Upload and use file with real API", async () => {
  // This test is skipped as files API is not available in the current SDK version
});

skipIfNoIntegration("Integration: Handle API error gracefully", async () => {
  const client = Anthropic.client()
    .withDefaults()
    .withEnv()
    .build();
  
  try {
    // Try to create a message with invalid parameters
    await client.messages.create({
      model: 'invalid-model-name',
      max_tokens: 50,
      messages: [
        { role: 'user', content: 'This should fail.' }
      ]
    });
    
    // Should not reach here
    expect(false).toBe(true);
  } catch (error: any) {
    expect(error).toBeDefined();
    expect(error.status).toBeDefined();
    console.log('Integration error handling test - error status:', error.status);
  }
});

// Test configuration loading with real environment
test("Integration config: Load configuration from environment", () => {
  if (SKIP_INTEGRATION) return;
  
  const client = Anthropic.client()
    .withDefaults()
    .withEnv()
    .build();
  
  const config = client.getConfig();
  expect(config.api_key).toBeDefined();
  expect(config.api_key.length).toBeGreaterThan(0);
  expect(config.model).toBeDefined();
  expect(config.max_tokens).toBeGreaterThan(0);
  expect(config.base_url).toBeDefined();
  expect(config.timeout).toBeGreaterThan(0);
  
  console.log('Integration config test - model:', config.model);
});