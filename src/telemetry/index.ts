/**
 * Telemetry system for A2A agent interactions.
 * Creates a write-behind logging system that captures request/response pairs
 * and logs them to Azure Append Blob storage via a Bun Worker.
 */

import { createFlusher, type FlushPolicy } from './flusher.js';

export interface TelemetrySystem {
  emit(line: unknown): void;
  stop(): Promise<void>;
}

export interface TelemetryLine {
  dir: 'in' | 'out';
  at: number;
  contextId?: string;
  taskId?: string;
  messageId?: string;
  message?: any;
  result?: any;
}

export function createTelemetry(policy?: FlushPolicy): TelemetrySystem {
  // Check if we're in a Web Worker environment (Bun) or Node.js
  const isWebWorkerAvailable = typeof Worker !== 'undefined';
  
  if (isWebWorkerAvailable) {
    // Use Web Worker approach (Bun)
    return createWebWorkerTelemetry(policy);
  } else {
    // Use console fallback for Node.js (for PoC demo)
    return createConsoleTelemetry(policy);
  }
}

function createWebWorkerTelemetry(policy?: FlushPolicy): TelemetrySystem {
  // Create the Bun Worker for Azure operations
  const worker = new Worker(new URL('./azure_worker.ts', import.meta.url).href);
  
  // Create the flusher with the worker's postMessage as the post function
  const flusher = createFlusher({
    post: (u8: Uint8Array) => {
      // Transfer the ArrayBuffer to avoid copying
      worker.postMessage({ type: 'append', u8 }, [u8.buffer]);
    },
    policy: {
      flushBytes: +(process.env.A2A_POC_FLUSH_BYTES || '65536'),
      flushSeconds: +(process.env.A2A_POC_FLUSH_SECS || '2'),
      ...policy
    }
  });

  function emit(line: unknown): void {
    try {
      // Serialize the line as NDJSON (newline-delimited JSON)
      const jsonStr = JSON.stringify(line);
      const ndjsonLine = jsonStr + '\n';
      const buffer = new TextEncoder().encode(ndjsonLine);
      
      flusher.enqueue(buffer);
    } catch (error) {
      console.error('[Telemetry] Failed to serialize telemetry line:', error, line);
    }
  }

  async function stop(): Promise<void> {
    try {
      // Stop the flusher (flushes remaining data)
      await flusher.stop();
      
      // Signal the worker to close
      worker.postMessage({ type: 'close' });
      
      // Give the worker a moment to clean up
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('[Telemetry] Error during shutdown:', error);
    }
  }

  return { emit, stop };
}

function createConsoleTelemetry(policy?: FlushPolicy): TelemetrySystem {
  console.log('[Telemetry] Using console fallback (Azure blob storage not available)');
  
  // Create the flusher with console output
  const flusher = createFlusher({
    post: (u8: Uint8Array) => {
      // Log to console instead of blob
      const content = new TextDecoder().decode(u8);
      console.log('[Telemetry] Would write to blob:', content);
    },
    policy: {
      flushBytes: +(process.env.A2A_POC_FLUSH_BYTES || '65536'),
      flushSeconds: +(process.env.A2A_POC_FLUSH_SECS || '2'),
      ...policy
    }
  });

  function emit(line: unknown): void {
    try {
      // Serialize the line as NDJSON (newline-delimited JSON)
      const jsonStr = JSON.stringify(line);
      const ndjsonLine = jsonStr + '\n';
      const buffer = new TextEncoder().encode(ndjsonLine);
      
      flusher.enqueue(buffer);
    } catch (error) {
      console.error('[Telemetry] Failed to serialize telemetry line:', error, line);
    }
  }

  async function stop(): Promise<void> {
    try {
      // Stop the flusher (flushes remaining data)
      await flusher.stop();
      console.log('[Telemetry] Console telemetry stopped');
    } catch (error) {
      console.error('[Telemetry] Error during shutdown:', error);
    }
  }

  return { emit, stop };
}

// Utility functions for creating telemetry lines
export function createInboundLine(
  contextId: string,
  message: any,
  timestamp = Date.now()
): TelemetryLine {
  return {
    dir: 'in',
    at: timestamp,
    contextId,
    message: minimalSafeCopy(message)
  };
}

export function createOutboundLine(
  contextId: string,
  result: any,
  timestamp = Date.now()
): TelemetryLine {
  return {
    dir: 'out',
    at: timestamp,
    contextId,
    result: minimalSafeCopy(result)
  };
}

/**
 * Create a minimal, safe copy of an object for logging.
 * Removes potentially sensitive or large fields.
 */
function minimalSafeCopy(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(minimalSafeCopy);
  }

  const copy: any = {};
  for (const [key, value] of Object.entries(obj)) {
    // Skip potentially sensitive fields
    if (key.toLowerCase().includes('password') || 
        key.toLowerCase().includes('token') || 
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('key')) {
      copy[key] = '[REDACTED]';
      continue;
    }

    // Limit string length to prevent huge logs
    if (typeof value === 'string' && value.length > 1000) {
      copy[key] = value.substring(0, 1000) + '...[TRUNCATED]';
      continue;
    }

    // Recursively process objects
    if (typeof value === 'object' && value !== null) {
      copy[key] = minimalSafeCopy(value);
    } else {
      copy[key] = value;
    }
  }

  return copy;
}