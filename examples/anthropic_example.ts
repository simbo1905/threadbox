// Example usage of the Anthropic client
import { Anthropic } from '../src/anthropic/client';

async function main() {
  try {
    // Method 1: Using builder pattern with configuration file
    const client1 = Anthropic.client()
      .withDefaults()  // Load from config.toml
      .withEnv()       // Apply environment variable overrides
      .build();

    // Method 2: Using builder pattern with direct configuration
    const client2 = Anthropic.client()
      .apiKey(process.env.ANTHROPIC_API_KEY || 'your-api-key')
      .model('claude-3-5-haiku-20241022')
      .maxTokens(1000)
      .baseUrl('https://api.anthropic.com/v1/')
      .timeout(30000)
      .build();

    // Example: Create a simple message
    const response = await client2.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [
        { role: 'user', content: 'Hello! Can you help me with TypeScript?' }
      ]
    });

    console.log('Response:', response.content[0]);

    // Example: Stream a message
    const stream = await client2.messages.stream({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 100,
      messages: [
        { role: 'user', content: 'Count from 1 to 5' }
      ]
    });

    console.log('Streaming response:');
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        process.stdout.write(event.delta.text);
      }
    }
    console.log('\nStream completed.');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Only run if this file is executed directly
if (import.meta.main) {
  main();
}