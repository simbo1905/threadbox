/**
 * Size/time write-behind flusher for telemetry data.
 * Batches NDJSON lines and flushes based on size or time thresholds.
 */

export interface FlushPolicy {
  flushBytes?: number;
  flushSeconds?: number;
}

export interface Flusher {
  enqueue(line: Uint8Array): void;
  stop(): Promise<void>;
}

export function createFlusher({ 
  post, 
  policy 
}: { 
  post: (data: Uint8Array) => void; 
  policy: FlushPolicy 
}): Flusher {
  let queuedBytes = 0;
  let lastFlushAt = Date.now();
  let buffer: Uint8Array[] = [];
  let flushTimer: NodeJS.Timeout | null = null;

  const flushBytesThreshold = policy.flushBytes || 65536;
  const flushSecondsThreshold = (policy.flushSeconds || 2) * 1000;

  function scheduleFlush() {
    if (flushTimer) return;
    
    flushTimer = setTimeout(() => {
      flush();
    }, flushSecondsThreshold);
  }

  function flush() {
    if (buffer.length === 0) return;

    // Concatenate all buffered lines into a single Uint8Array
    const totalLength = buffer.reduce((sum, buf) => sum + buf.length, 0);
    const batch = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const buf of buffer) {
      batch.set(buf, offset);
      offset += buf.length;
    }

    post(batch);
    
    // Reset state
    buffer = [];
    queuedBytes = 0;
    lastFlushAt = Date.now();
    
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }

  function enqueue(line: Uint8Array) {
    buffer.push(line);
    queuedBytes += line.length;
    
    const now = Date.now();
    const shouldFlushBySize = queuedBytes >= flushBytesThreshold;
    const shouldFlushByTime = now - lastFlushAt >= flushSecondsThreshold;
    
    if (shouldFlushBySize || shouldFlushByTime) {
      flush();
    } else {
      scheduleFlush();
    }
  }

  async function stop(): Promise<void> {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flush(); // Flush any remaining data
  }

  return { enqueue, stop };
}