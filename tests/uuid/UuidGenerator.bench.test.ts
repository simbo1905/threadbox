/**
 * UUID Generator Benchmark Tests
 * 
 * Performance benchmarks to validate the claimed 0.5M UUIDs per second throughput
 * and provide detailed timing analysis under various load conditions.
 * 
 * These tests are intensive and disabled by default. Set UUID_BENCHMARK_TESTS=1 to enable.
 */

import { describe, it, expect } from "bun:test";
import { UuidGenerator } from "../../src/uuid/UuidGenerator.js";

const SKIP_BENCHMARKS = !process.env.UUID_BENCHMARK_TESTS;

/**
 * High-resolution timing utility
 */
class Timer {
  private start: number;
  private end?: number;

  constructor() {
    this.start = process.hrtime.bigint();
  }

  stop(): number {
    this.end = process.hrtime.bigint();
    return Number(this.end - this.start) / 1_000_000; // Convert to milliseconds
  }

  get elapsedMs(): number {
    const current = this.end || process.hrtime.bigint();
    return Number(current - this.start) / 1_000_000;
  }
}

/**
 * Benchmark result container
 */
interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTimeMs: number;
  avgTimeMs: number;
  opsPerSecond: number;
  throughput: string;
}

/**
 * Run a benchmark and return detailed results
 */
function benchmark(name: string, iterations: number, operation: () => void): BenchmarkResult {
  // Warmup phase
  const warmupIterations = Math.min(1000, Math.floor(iterations * 0.1));
  for (let i = 0; i < warmupIterations; i++) {
    operation();
  }

  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  // Actual benchmark
  const timer = new Timer();
  for (let i = 0; i < iterations; i++) {
    operation();
  }
  const totalTimeMs = timer.stop();

  return {
    operation: name,
    iterations,
    totalTimeMs,
    avgTimeMs: totalTimeMs / iterations,
    opsPerSecond: iterations / (totalTimeMs / 1000),
    throughput: `${(iterations / (totalTimeMs / 1000) / 1_000_000).toFixed(2)}M ops/sec`
  };
}

/**
 * Verify UUIDs are properly formatted and unique
 */
function validateUuids(uuids: string[]): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  expect(uuids.length).toBeGreaterThan(0);
  
  // All UUIDs should be valid format
  for (const uuid of uuids) {
    expect(uuidRegex.test(uuid)).toBe(true);
    expect(uuid.length).toBe(36);
  }
  
  // All UUIDs should be unique
  expect(new Set(uuids).size).toBe(uuids.length);
}

/**
 * Generate a batch of UUIDs
 */
function generateBatch(count: number): string[] {
  const uuids: string[] = [];
  for (let i = 0; i < count; i++) {
    uuids.push(UuidGenerator.generateUUID());
  }
  return uuids;
}

describe("UUID Generator Benchmarks", () => {
  it("should validate basic UUID generation works", () => {
    if (SKIP_BENCHMARKS) {
      console.log("Benchmark tests skipped. Set UUID_BENCHMARK_TESTS=1 to enable.");
      return;
    }
    const uuids = generateBatch(100);
    validateUuids(uuids);
  });

  it("should demonstrate time-ordered generation with sleep", () => {
    if (SKIP_BENCHMARKS) return;
    const uuids: string[] = [];
    
    // Generate UUIDs with small delays to show time ordering
    for (let i = 0; i < 12; i++) {
      uuids.push(UuidGenerator.generateUUID());
      if (i < 11) {
        // Small sleep to ensure different millisecond timestamps
        const start = Date.now();
        while (Date.now() === start) {
          // Busy wait for next millisecond
        }
      }
    }
    
    // Validate all UUIDs
    validateUuids(uuids);
    
    // Verify they are in ascending order (time-based)
    for (let i = 1; i < uuids.length; i++) {
      expect(uuids[i] > uuids[i-1]).toBe(true);
    }
    
    console.log("\nTime-ordered UUID generation (12 samples):");
    uuids.forEach((uuid, i) => {
      console.log(`  ${i + 1}: ${uuid}`);
    });
  });

  it("should benchmark small batch performance", () => {
    if (SKIP_BENCHMARKS) return;
    const result = benchmark("Small Batch (1K UUIDs)", 1000, () => {
      UuidGenerator.generateUUID();
    });

    console.log(`\n${result.operation}:`);
    console.log(`  Iterations: ${result.iterations.toLocaleString()}`);
    console.log(`  Total time: ${result.totalTimeMs.toFixed(2)}ms`);
    console.log(`  Average time: ${result.avgTimeMs.toFixed(4)}ms per UUID`);
    console.log(`  Throughput: ${result.throughput}`);
    
    expect(result.opsPerSecond).toBeGreaterThan(100_000); // At least 100K ops/sec
  });

  it("should benchmark medium batch performance", () => {
    if (SKIP_BENCHMARKS) return;
    const result = benchmark("Medium Batch (10K UUIDs)", 10_000, () => {
      UuidGenerator.generateUUID();
    });

    console.log(`\n${result.operation}:`);
    console.log(`  Iterations: ${result.iterations.toLocaleString()}`);
    console.log(`  Total time: ${result.totalTimeMs.toFixed(2)}ms`);
    console.log(`  Average time: ${result.avgTimeMs.toFixed(4)}ms per UUID`);
    console.log(`  Throughput: ${result.throughput}`);
    
    expect(result.opsPerSecond).toBeGreaterThan(200_000); // At least 200K ops/sec
  });

  it("should benchmark large batch performance", () => {
    if (SKIP_BENCHMARKS) return;
    const result = benchmark("Large Batch (100K UUIDs)", 100_000, () => {
      UuidGenerator.generateUUID();
    });

    console.log(`\n${result.operation}:`);
    console.log(`  Iterations: ${result.iterations.toLocaleString()}`);
    console.log(`  Total time: ${result.totalTimeMs.toFixed(2)}ms`);
    console.log(`  Average time: ${result.avgTimeMs.toFixed(4)}ms per UUID`);
    console.log(`  Throughput: ${result.throughput}`);
    
    expect(result.opsPerSecond).toBeGreaterThan(300_000); // At least 300K ops/sec
  });

  it("should benchmark sustained performance", () => {
    if (SKIP_BENCHMARKS) return;
    const result = benchmark("Sustained Performance (500K UUIDs)", 500_000, () => {
      UuidGenerator.generateUUID();
    });

    console.log(`\n${result.operation}:`);
    console.log(`  Iterations: ${result.iterations.toLocaleString()}`);
    console.log(`  Total time: ${result.totalTimeMs.toFixed(2)}ms`);
    console.log(`  Average time: ${result.avgTimeMs.toFixed(4)}ms per UUID`);
    console.log(`  Throughput: ${result.throughput}`);
    
    // Validate the claimed 0.5M per second performance
    expect(result.opsPerSecond).toBeGreaterThan(400_000); // At least 400K ops/sec
  });

  it("should benchmark batch generation performance", () => {
    if (SKIP_BENCHMARKS) return;
    const batchSizes = [100, 1000, 10000];
    
    for (const batchSize of batchSizes) {
      const result = benchmark(`Batch Generation (${batchSize} UUIDs)`, batchSize, () => {
        generateBatch(batchSize);
      });

      console.log(`\n${result.operation}:`);
      console.log(`  Total time: ${result.totalTimeMs.toFixed(2)}ms`);
      console.log(`  Average time per UUID: ${(result.avgTimeMs / batchSize).toFixed(4)}ms`);
      console.log(`  Batch throughput: ${result.throughput}`);
    }
  });

  it("should benchmark memory efficiency", () => {
    if (SKIP_BENCHMARKS) return;
    // Generate a large number of UUIDs and measure memory usage
    const iterations = 50_000;
    const uuids: string[] = [];
    
    const timer = new Timer();
    
    for (let i = 0; i < iterations; i++) {
      uuids.push(UuidGenerator.generateUUID());
    }
    
    const timeMs = timer.stop();
    const opsPerSecond = iterations / (timeMs / 1000);
    
    console.log(`\nMemory Efficiency Test (${iterations} UUIDs):`);
    console.log(`  Total time: ${timeMs.toFixed(2)}ms`);
    console.log(`  Throughput: ${(opsPerSecond / 1_000_000).toFixed(2)}M ops/sec`);
    console.log(`  Memory usage: ~${(uuids.length * 36 * 2 / 1024 / 1024).toFixed(2)} MB`);
    
    // Validate all UUIDs are unique
    expect(new Set(uuids).size).toBe(iterations);
  });

  it("should compare performance against claimed targets", () => {
    if (SKIP_BENCHMARKS) return;
    console.log("\n=== Performance Comparison Against Claims ===");
    
    // Claim: "0.5M per second (similar to the Java version)"
    const targetOpsPerSecond = 500_000;
    
    const result = benchmark("Performance Validation", 100_000, () => {
      UuidGenerator.generateUUID();
    });
    
    const achievedOpsPerSecond = result.opsPerSecond;
    const percentageOfTarget = (achievedOpsPerSecond / targetOpsPerSecond) * 100;
    
    console.log(`\nTarget performance: ${(targetOpsPerSecond / 1_000_000).toFixed(1)}M ops/sec`);
    console.log(`Achieved performance: ${(achievedOpsPerSecond / 1_000_000).toFixed(2)}M ops/sec`);
    console.log(`Percentage of target: ${percentageOfTarget.toFixed(1)}%`);
    
    if (achievedOpsPerSecond >= targetOpsPerSecond) {
      console.log("✅ Performance claim VALIDATED");
    } else {
      console.log("❌ Performance claim NOT MET");
    }
    
    expect(achievedOpsPerSecond).toBeGreaterThan(targetOpsPerSecond * 0.8); // At least 80% of claimed performance
  });
});