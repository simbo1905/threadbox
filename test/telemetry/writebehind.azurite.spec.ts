/**
 * Write-behind telemetry unit tests with Azurite.
 * Tests the flusher and worker components against local Azure blob storage.
 */

import { test, expect, beforeAll, afterAll } from "bun:test";
import { BlobServiceClient } from "@azure/storage-blob";
import { createTelemetry } from "../../src/telemetry/index.js";

const CONN = process.env.AZURE_STORAGE_CONNECTION_STRING || "UseDevelopmentStorage=true";
const SKIP = !!process.env.POC_AGENT_DSL;
const TEST_CONTAINER = process.env.A2A_POC_CONTAINER || "a2a-poc-test";

// Override container name for tests
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

test("telemetry system appends NDJSON lines to blob storage", async () => {
  if (SKIP) return;
  
  const containerName = uniqueName("telemetry-test");
  
  // Override container for this test
  const originalContainer = process.env.A2A_POC_CONTAINER;
  process.env.A2A_POC_CONTAINER = containerName;
  
  try {
    // Create telemetry with small thresholds for testing
    const telemetry = createTelemetry({
      flushBytes: 512,    // Small threshold to trigger flushes
      flushSeconds: 1     // Quick flush interval
    });

    // Emit test telemetry lines
    const testLines = [
      { dir: "in", at: Date.now(), contextId: "test-ctx-1", message: { content: "Hello world" } },
      { dir: "out", at: Date.now(), contextId: "test-ctx-1", result: { content: "Echo: Hello world" } },
      { dir: "in", at: Date.now(), contextId: "test-ctx-2", message: { content: "Another message" } }
    ];

    for (const line of testLines) {
      telemetry.emit(line);
    }

    // Wait for flushes to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Stop telemetry (should flush remaining data)
    await telemetry.stop();

    // Read back the blob contents
    const blobContents = await readAllBlobsFromContainer(containerName);
    
    expect(blobContents.length).toBeGreaterThan(0);
    
    // Combine all blob contents
    const allContent = blobContents.join('');
    
    // Parse NDJSON lines
    const lines = allContent.trim().split('\n').filter(line => line.trim());
    expect(lines.length).toBeGreaterThanOrEqual(3);
    
    // Verify each line is valid JSON
    const parsedLines = lines.map(line => {
      expect(() => JSON.parse(line)).not.toThrow();
      return JSON.parse(line);
    });

    // Check that we have the expected content
    const inLines = parsedLines.filter(line => line.dir === 'in');
    const outLines = parsedLines.filter(line => line.dir === 'out');
    
    expect(inLines.length).toBeGreaterThanOrEqual(2);
    expect(outLines.length).toBeGreaterThanOrEqual(1);
    
    // Verify structure of lines
    for (const line of parsedLines) {
      expect(line).toHaveProperty('dir');
      expect(line).toHaveProperty('at');
      expect(typeof line.at).toBe('number');
      expect(['in', 'out']).toContain(line.dir);
    }

  } finally {
    // Cleanup
    await cleanupContainer(containerName);
    
    // Restore original container setting
    if (originalContainer) {
      process.env.A2A_POC_CONTAINER = originalContainer;
    } else {
      delete process.env.A2A_POC_CONTAINER;
    }
  }
});

test("telemetry system handles size-based flushing", async () => {
  if (SKIP) return;
  
  const containerName = uniqueName("size-flush-test");
  const originalContainer = process.env.A2A_POC_CONTAINER;
  process.env.A2A_POC_CONTAINER = containerName;
  
  try {
    // Create telemetry with very small byte threshold
    const telemetry = createTelemetry({
      flushBytes: 200,    // Very small to trigger on just a few lines
      flushSeconds: 10    // Long interval so size triggers first
    });

    // Emit lines that should exceed the byte threshold
    const largeLine = { 
      dir: "in", 
      at: Date.now(), 
      contextId: "size-test", 
      message: { 
        content: "This is a longer message that should help trigger the size-based flush threshold when combined with other similar messages in the buffer."
      } 
    };

    // Emit multiple large lines
    for (let i = 0; i < 5; i++) {
      telemetry.emit({ ...largeLine, message: { content: `${largeLine.message.content} - iteration ${i}` } });
    }

    // Wait a bit for size-based flush
    await new Promise(resolve => setTimeout(resolve, 1000));

    await telemetry.stop();

    // Verify data was written
    const blobContents = await readAllBlobsFromContainer(containerName);
    expect(blobContents.length).toBeGreaterThan(0);
    
    const allContent = blobContents.join('');
    const lines = allContent.trim().split('\n').filter(line => line.trim());
    expect(lines.length).toBeGreaterThanOrEqual(5);

  } finally {
    await cleanupContainer(containerName);
    if (originalContainer) {
      process.env.A2A_POC_CONTAINER = originalContainer;
    } else {
      delete process.env.A2A_POC_CONTAINER;
    }
  }
});

test("telemetry system handles time-based flushing", async () => {
  if (SKIP) return;
  
  const containerName = uniqueName("time-flush-test");
  const originalContainer = process.env.A2A_POC_CONTAINER;
  process.env.A2A_POC_CONTAINER = containerName;
  
  try {
    // Create telemetry with large byte threshold but short time interval
    const telemetry = createTelemetry({
      flushBytes: 10000,  // Large threshold that won't be hit
      flushSeconds: 1     // Short interval to trigger time-based flush
    });

    // Emit a single small line
    telemetry.emit({ 
      dir: "in", 
      at: Date.now(), 
      contextId: "time-test", 
      message: { content: "Small message" } 
    });

    // Wait for time-based flush
    await new Promise(resolve => setTimeout(resolve, 2500));

    await telemetry.stop();

    // Verify data was written despite not hitting size threshold
    const blobContents = await readAllBlobsFromContainer(containerName);
    expect(blobContents.length).toBeGreaterThan(0);
    
    const allContent = blobContents.join('');
    const lines = allContent.trim().split('\n').filter(line => line.trim());
    expect(lines.length).toBeGreaterThanOrEqual(1);

  } finally {
    await cleanupContainer(containerName);
    if (originalContainer) {
      process.env.A2A_POC_CONTAINER = originalContainer;
    } else {
      delete process.env.A2A_POC_CONTAINER;
    }
  }
});