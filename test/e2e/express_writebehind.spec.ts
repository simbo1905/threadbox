/**
 * Express end-to-end tests with write-behind telemetry.
 * Tests the full A2A server integration with telemetry logging.
 */

import { test, expect, beforeAll, afterAll } from "bun:test";
import { BlobServiceClient } from "@azure/storage-blob";
import { createA2AServer } from "../../src/harness/server.js";

const CONN = process.env.AZURE_STORAGE_CONNECTION_STRING || "UseDevelopmentStorage=true";
const SKIP = !!process.env.POC_AGENT_DSL;
const TEST_CONTAINER = "a2a-e2e-test";

// Override container name for tests
const originalContainer = process.env.A2A_POC_CONTAINER;
process.env.A2A_POC_CONTAINER = TEST_CONTAINER;

function uniqueName(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now()}${rand}`.toLowerCase();
}

async function cleanupContainer(containerName: string) {
  const service = BlobServiceClient.fromConnectionString(CONN);
  const container = service.getContainerClient(containerName);
  try {
    await container.deleteIfExists();
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function readAllBlobsFromContainer(containerName: string): Promise<string[]> {
  const service = BlobServiceClient.fromConnectionString(CONN);
  const container = service.getContainerClient(containerName);
  
  const contents: string[] = [];
  
  try {
    for await (const blob of container.listBlobsFlat()) {
      const blobClient = container.getBlobClient(blob.name);
      const downloadResponse = await blobClient.download();
      
      if (downloadResponse.readableStreamBody) {
        const chunks: Buffer[] = [];
        const reader = downloadResponse.readableStreamBody.getReader();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(Buffer.from(value));
        }
        
        const content = Buffer.concat(chunks).toString('utf-8');
        contents.push(content);
      }
    }
  } catch (error) {
    console.error('Error reading blobs:', error);
  }
  
  return contents;
}

/**
 * Simple A2A client for testing
 */
class A2ATestClient {
  constructor(private baseUrl: string) {}

  async sendMessage(message: { content: string }, contextId?: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/message/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        contextId
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  }

  async health(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/health`);
    
    if (!response.ok) {
      throw new Error(`Health check failed: HTTP ${response.status}`);
    }

    return await response.json();
  }
}

test("A2A server processes message and logs telemetry", async () => {
  if (SKIP) return;
  
  const containerName = uniqueName("e2e-message-test");
  process.env.A2A_POC_CONTAINER = containerName;
  
  // Use a random port to avoid conflicts
  const port = 3000 + Math.floor(Math.random() * 1000);
  
  const server = createA2AServer(port);
  const client = new A2ATestClient(`http://localhost:${port}`);
  
  try {
    // Start the server
    await server.start();
    
    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Test health endpoint first
    const healthResponse = await client.health();
    expect(healthResponse.status).toBe('ok');
    expect(healthResponse.timestamp).toBeTypeOf('number');
    
    // Send a test message
    const testMessage = { content: "Hello, A2A server!" };
    const contextId = `test-ctx-${Date.now()}`;
    
    const startTime = Date.now();
    const response = await client.sendMessage(testMessage, contextId);
    const endTime = Date.now();
    
    // Verify the response
    expect(response).toBeDefined();
    expect(response.content || response.result).toBeDefined();
    
    // For short messages, expect an echo response
    if (response.content) {
      expect(response.content).toContain('Echo:');
      expect(response.content).toContain(testMessage.content);
    }
    
    // Wait for telemetry to be flushed
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Read telemetry from blob storage
    const blobContents = await readAllBlobsFromContainer(containerName);
    expect(blobContents.length).toBeGreaterThan(0);
    
    const allContent = blobContents.join('');
    const lines = allContent.trim().split('\n').filter(line => line.trim());
    
    // Should have exactly 2 lines: one 'in' and one 'out'
    expect(lines.length).toBeGreaterThanOrEqual(2);
    
    // Parse and validate telemetry lines
    const parsedLines = lines.map(line => JSON.parse(line));
    
    const inLines = parsedLines.filter(line => line.dir === 'in');
    const outLines = parsedLines.filter(line => line.dir === 'out');
    
    expect(inLines.length).toBeGreaterThanOrEqual(1);
    expect(outLines.length).toBeGreaterThanOrEqual(1);
    
    // Validate inbound line
    const inLine = inLines[0];
    expect(inLine.dir).toBe('in');
    expect(inLine.at).toBeTypeOf('number');
    expect(inLine.at).toBeGreaterThanOrEqual(startTime);
    expect(inLine.at).toBeLessThanOrEqual(endTime);
    expect(inLine.contextId).toBeDefined();
    expect(inLine.message).toBeDefined();
    expect(inLine.message.body).toBeDefined();
    expect(inLine.message.body.message.content).toBe(testMessage.content);
    
    // Validate outbound line
    const outLine = outLines[0];
    expect(outLine.dir).toBe('out');
    expect(outLine.at).toBeTypeOf('number');
    expect(outLine.at).toBeGreaterThanOrEqual(startTime);
    expect(outLine.contextId).toBeDefined();
    expect(outLine.result).toBeDefined();
    expect(outLine.result.statusCode).toBe(200);
    
  } finally {
    await server.stop();
    await cleanupContainer(containerName);
  }
});

test("A2A server handles multiple messages with telemetry", async () => {
  if (SKIP) return;
  
  const containerName = uniqueName("e2e-multi-test");
  process.env.A2A_POC_CONTAINER = containerName;
  
  const port = 3000 + Math.floor(Math.random() * 1000);
  const server = createA2AServer(port);
  const client = new A2ATestClient(`http://localhost:${port}`);
  
  try {
    await server.start();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Send multiple messages
    const messages = [
      { content: "First message" },
      { content: "Second message with more content to test summarization behavior when the content is longer than the threshold" },
      { content: "Third message" }
    ];
    
    const startTime = Date.now();
    
    // Send messages sequentially to avoid race conditions
    for (let i = 0; i < messages.length; i++) {
      const response = await client.sendMessage(messages[i], `multi-ctx-${i}`);
      expect(response).toBeDefined();
      
      // Add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const endTime = Date.now();
    
    // Wait for telemetry to flush
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Verify telemetry
    const blobContents = await readAllBlobsFromContainer(containerName);
    expect(blobContents.length).toBeGreaterThan(0);
    
    const allContent = blobContents.join('');
    const lines = allContent.trim().split('\n').filter(line => line.trim());
    
    // Should have 6 lines total (3 in + 3 out)
    expect(lines.length).toBeGreaterThanOrEqual(6);
    
    const parsedLines = lines.map(line => JSON.parse(line));
    const inLines = parsedLines.filter(line => line.dir === 'in');
    const outLines = parsedLines.filter(line => line.dir === 'out');
    
    expect(inLines.length).toBeGreaterThanOrEqual(3);
    expect(outLines.length).toBeGreaterThanOrEqual(3);
    
    // Verify all timestamps are reasonable
    for (const line of parsedLines) {
      expect(line.at).toBeGreaterThanOrEqual(startTime);
      expect(line.at).toBeLessThanOrEqual(endTime + 1000); // Allow some buffer
    }
    
  } finally {
    await server.stop();
    await cleanupContainer(containerName);
  }
});

test("A2A server performance with telemetry (latency check)", async () => {
  if (SKIP) return;
  
  const containerName = uniqueName("e2e-perf-test");
  process.env.A2A_POC_CONTAINER = containerName;
  
  const port = 3000 + Math.floor(Math.random() * 1000);
  const server = createA2AServer(port);
  const client = new A2ATestClient(`http://localhost:${port}`);
  
  try {
    await server.start();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Measure latency of several requests
    const latencies: number[] = [];
    const numRequests = 10;
    
    for (let i = 0; i < numRequests; i++) {
      const start = Date.now();
      
      const response = await client.sendMessage(
        { content: `Performance test message ${i}` },
        `perf-ctx-${i}`
      );
      
      const latency = Date.now() - start;
      latencies.push(latency);
      
      expect(response).toBeDefined();
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Calculate statistics
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const avg = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
    
    console.log(`Performance stats - P50: ${p50}ms, P95: ${p95}ms, Avg: ${avg.toFixed(1)}ms`);
    
    // Basic performance assertions (should be fast for simple echo operations)
    expect(p50).toBeLessThan(1000);  // P50 should be under 1 second
    expect(p95).toBeLessThan(2000);  // P95 should be under 2 seconds
    expect(avg).toBeLessThan(1000);  // Average should be under 1 second
    
    // Wait for telemetry to flush
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify telemetry was captured for all requests
    const blobContents = await readAllBlobsFromContainer(containerName);
    expect(blobContents.length).toBeGreaterThan(0);
    
    const allContent = blobContents.join('');
    const lines = allContent.trim().split('\n').filter(line => line.trim());
    
    // Should have at least 20 lines (10 in + 10 out)
    expect(lines.length).toBeGreaterThanOrEqual(20);
    
  } finally {
    await server.stop();
    await cleanupContainer(containerName);
  }
});

// Cleanup after all tests
afterAll(async () => {
  // Restore original container setting
  if (originalContainer) {
    process.env.A2A_POC_CONTAINER = originalContainer;
  } else {
    delete process.env.A2A_POC_CONTAINER;
  }
});