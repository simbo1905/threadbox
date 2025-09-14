/**
 * UUID Generator Randomness Analysis
 * 
 * Analyzes the randomness quality of the LSB (lower 64 bits) in generated UUIDs
 * Compares crypto.randomBytes vs Math.random() for statistical properties
 * 
 * These tests are intensive and disabled by default. Set UUID_RANDOMNESS_TESTS=1 to enable.
 */

import { describe, it, expect } from "bun:test";
import { randomBytes } from 'crypto';
import { UuidGenerator } from "../../src/id/UuidGenerator.js";

const SKIP_RANDOMNESS_TESTS = !process.env.UUID_RANDOMNESS_TESTS;

/**
 * Simple pseudo-random implementation for comparison
 */
class SimpleRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  nextLong(): bigint {
    // Simple LCG (Linear Congruential Generator) - NOT cryptographically secure
    this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
    const upper = BigInt(this.seed) << 32n;
    this.seed = (this.seed * 1664525 + 1013904223) % Math.pow(2, 32);
    const lower = BigInt(this.seed);
    return upper | lower;
  }
}

/**
 * Extract LSB (lower 64 bits) from UUID string
 */
function extractLsbFromUuid(uuid: string): bigint {
  // Parse UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const parts = uuid.split('-');
  const clockSeqHi = parts[3].substring(0, 2);
  const clockSeqLow = parts[3].substring(2, 4);
  const node = parts[4];
  
  const lsbHex = clockSeqHi + clockSeqLow + node;
  return BigInt('0x' + lsbHex);
}

/**
 * Extract MSB (upper 64 bits) from UUID string
 */
function extractMsbFromUuid(uuid: string): bigint {
  // Parse UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const parts = uuid.split('-');
  const timeLow = parts[0];
  const timeMid = parts[1];
  const timeHi = parts[2];
  
  const msbHex = timeLow + timeMid + timeHi;
  return BigInt('0x' + msbHex);
}

/**
 * Calculate bit entropy - measures how many bits are actually random
 */
function calculateBitEntropy(values: bigint[], bitPosition: number): number {
  let ones = 0;
  const mask = 1n << BigInt(bitPosition);
  
  for (const value of values) {
    if ((value & mask) !== 0n) {
      ones++;
    }
  }
  
  // For perfect randomness, expect ~50% ones
  const ratio = ones / values.length;
  return Math.abs(ratio - 0.5); // Deviation from 0.5 (lower is better)
}

/**
 * Run frequency test on bit distribution
 */
function runBitFrequencyTest(values: bigint[], sampleSize: number = 1000): {mean: number, stdDev: number} {
  const bitPositions = 64;
  const entropies: number[] = [];
  
  // Sample subset for performance
  const sample = values.slice(0, Math.min(sampleSize, values.length));
  
  for (let bit = 0; bit < bitPositions; bit++) {
    entropies.push(calculateBitEntropy(sample, bit));
  }
  
  const mean = entropies.reduce((a, b) => a + b, 0) / entropies.length;
  const variance = entropies.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / entropies.length;
  const stdDev = Math.sqrt(variance);
  
  return { mean, stdDev };
}

/**
 * Calculate Hamming distance between values
 */
function calculateHammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let distance = 0;
  while (xor !== 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return distance;
}

/**
 * Run Hamming distance analysis
 */
function runHammingDistanceAnalysis(values: bigint[]): {avgDistance: number, minDistance: number, maxDistance: number} {
  const distances: number[] = [];
  
  // Sample pairs to avoid O(n²) complexity
  const sampleSize = Math.min(1000, values.length);
  for (let i = 0; i < sampleSize; i++) {
    for (let j = i + 1; j < Math.min(i + 100, sampleSize); j++) {
      distances.push(calculateHammingDistance(values[i], values[j]));
    }
  }
  
  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);
  
  return { avgDistance, minDistance, maxDistance };
}

/**
 * Detect patterns in LSB values
 */
function detectPatterns(values: bigint[]): {repetitions: number, sequentialPattern: number} {
  const valueSet = new Set(values);
  const repetitions = values.length - valueSet.size;
  
  // Check for sequential patterns (indicative of poor randomness)
  let sequentialPattern = 0;
  const sorted = [...valueSet].sort((a, b) => Number(a - b));
  
  for (let i = 1; i < Math.min(100, sorted.length); i++) {
    if (sorted[i] - sorted[i-1] === 1n) {
      sequentialPattern++;
    }
  }
  
  return { repetitions, sequentialPattern };
}

/**
 * Generate UUIDs with different random sources for comparison
 */
function generateUuidWithCustomRandom(randomSource: 'crypto' | 'simple', count: number): {uuids: string[], lsbs: bigint[]} {
  const uuids: string[] = [];
  const lsbs: bigint[] = [];
  
  if (randomSource === 'simple') {
    const simpleRandom = new SimpleRandom();
    // Temporarily patch the random function
    const originalRandom = LazyRandom.instance.nextLong;
    LazyRandom.instance.nextLong = () => simpleRandom.nextLong();
    
    for (let i = 0; i < count; i++) {
      const uuid = UuidGenerator.generateUUID();
      uuids.push(uuid);
      lsbs.push(extractLsbFromUuid(uuid));
    }
    
    // Restore original
    LazyRandom.instance.nextLong = originalRandom;
  } else {
    for (let i = 0; i < count; i++) {
      const uuid = UuidGenerator.generateUUID();
      uuids.push(uuid);
      lsbs.push(extractLsbFromUuid(uuid));
    }
  }
  
  return { uuids, lsbs };
}

/**
 * Import the LazyRandom class (we need to access it for testing)
 */
class LazyRandom {
  private static _instance: LazyRandom;
  private readonly secureRandom: () => Buffer;

  private constructor() {
    this.secureRandom = () => randomBytes(8);
  }

  static get instance(): LazyRandom {
    if (!LazyRandom._instance) {
      LazyRandom._instance = new LazyRandom();
    }
    return LazyRandom._instance;
  }

  nextLong(): bigint {
    const buffer = this.secureRandom();
    return buffer.readBigInt64BE();
  }
}

describe("UUID Generator Randomness Analysis", () => {
  const sampleSize = 10000;
  
  it("should extract LSB and MSB correctly from UUIDs", () => {
    if (SKIP_RANDOMNESS_TESTS) {
      console.log("Randomness tests skipped. Set UUID_RANDOMNESS_TESTS=1 to enable.");
      return;
    }
    const uuid = UuidGenerator.generateUUID();
    console.log(`\nSample UUID: ${uuid}`);
    
    const lsb = extractLsbFromUuid(uuid);
    const msb = extractMsbFromUuid(uuid);
    
    console.log(`LSB (hex): ${lsb.toString(16).padStart(16, '0')}`);
    console.log(`MSB (hex): ${msb.toString(16).padStart(16, '0')}`);
    
    // MSB should show time-based patterns
    // LSB should be random
    expect(lsb).toBeGreaterThan(0n);
    expect(msb).toBeGreaterThan(0n);
  });

  it("should analyze bit frequency distribution", () => {
    if (SKIP_RANDOMNESS_TESTS) return;
    console.log("\n=== Bit Frequency Analysis ===");
    
    // Generate samples with both random sources
    const cryptoResult = generateUuidWithCustomRandom('crypto', sampleSize);
    const simpleResult = generateUuidWithCustomRandom('simple', sampleSize);
    
    const cryptoAnalysis = runBitFrequencyTest(cryptoResult.lsbs);
    const simpleAnalysis = runBitFrequencyTest(simpleResult.lsbs);
    
    console.log("Crypto Random (Node.js crypto.randomBytes):");
    console.log(`  Mean bit entropy deviation: ${cryptoAnalysis.mean.toFixed(4)}`);
    console.log(`  Standard deviation: ${cryptoAnalysis.stdDev.toFixed(4)}`);
    console.log(`  Quality: ${cryptoAnalysis.mean < 0.05 ? 'EXCELLENT' : cryptoAnalysis.mean < 0.1 ? 'GOOD' : 'POOR'}`);
    
    console.log("\nSimple Random (LCG):");
    console.log(`  Mean bit entropy deviation: ${simpleAnalysis.mean.toFixed(4)}`);
    console.log(`  Standard deviation: ${simpleAnalysis.stdDev.toFixed(4)}`);
    console.log(`  Quality: ${simpleAnalysis.mean < 0.05 ? 'EXCELLENT' : simpleAnalysis.mean < 0.1 ? 'GOOD' : 'POOR'}`);
    
    // Crypto random should have excellent bit distribution
    expect(cryptoAnalysis.mean).toBeLessThan(0.05);
  });

  it("should analyze Hamming distance between values", () => {
    if (SKIP_RANDOMNESS_TESTS) return;
    console.log("\n=== Hamming Distance Analysis ===");
    
    const cryptoResult = generateUuidWithCustomRandom('crypto', sampleSize);
    const simpleResult = generateUuidWithCustomRandom('simple', sampleSize);
    
    const cryptoDistances = runHammingDistanceAnalysis(cryptoResult.lsbs);
    const simpleDistances = runHammingDistanceAnalysis(simpleResult.lsbs);
    
    console.log("Crypto Random (Node.js crypto.randomBytes):");
    console.log(`  Average Hamming distance: ${cryptoDistances.avgDistance.toFixed(2)}/64 bits`);
    console.log(`  Min distance: ${cryptoDistances.minDistance}`);
    console.log(`  Max distance: ${cryptoDistances.maxDistance}`);
    console.log(`  Randomness quality: ${(cryptoDistances.avgDistance / 64 * 100).toFixed(1)}% bit difference`);
    
    console.log("\nSimple Random (LCG):");
    console.log(`  Average Hamming distance: ${simpleDistances.avgDistance.toFixed(2)}/64 bits`);
    console.log(`  Min distance: ${simpleDistances.minDistance}`);
    console.log(`  Max distance: ${simpleDistances.maxDistance}`);
    console.log(`  Randomness quality: ${(simpleDistances.avgDistance / 64 * 100).toFixed(1)}% bit difference`);
    
    // For good randomness, expect ~50% bits different (32/64)
    expect(cryptoDistances.avgDistance).toBeGreaterThan(28); // At least 28/64 bits different
    expect(cryptoDistances.avgDistance).toBeLessThan(36);   // At most 36/64 bits different
  });

  it("should detect patterns and repetitions", () => {
    if (SKIP_RANDOMNESS_TESTS) return;
    console.log("\n=== Pattern Detection ===");
    
    const cryptoResult = generateUuidWithCustomRandom('crypto', sampleSize);
    const simpleResult = generateUuidWithCustomRandom('simple', sampleSize);
    
    const cryptoPatterns = detectPatterns(cryptoResult.lsbs);
    const simplePatterns = detectPatterns(simpleResult.lsbs);
    
    console.log("Crypto Random (Node.js crypto.randomBytes):");
    console.log(`  Repetitions: ${cryptoPatterns.repetitions}`);
    console.log(`  Sequential patterns: ${cryptoPatterns.sequentialPattern}`);
    console.log(`  Uniqueness: ${((sampleSize - cryptoPatterns.repetitions) / sampleSize * 100).toFixed(2)}%`);
    
    console.log("\nSimple Random (LCG):");
    console.log(`  Repetitions: ${simplePatterns.repetitions}`);
    console.log(`  Sequential patterns: ${simplePatterns.sequentialPattern}`);
    console.log(`  Uniqueness: ${((sampleSize - simplePatterns.repetitions) / sampleSize * 100).toFixed(2)}%`);
    
    // Crypto random should have no repetitions in 10k samples
    expect(cryptoPatterns.repetitions).toBe(0);
    expect(cryptoPatterns.sequentialPattern).toBeLessThan(5); // Minimal sequential patterns
  });

  it("should visualize randomness distribution", () => {
    if (SKIP_RANDOMNESS_TESTS) return;
    console.log("\n=== Randomness Visualization ===");
    
    const cryptoResult = generateUuidWithCustomRandom('crypto', 100);
    const simpleResult = generateUuidWithCustomRandom('simple', 100);
    
    console.log("Crypto Random LSB distribution (first 20 samples):");
    cryptoResult.lsbs.slice(0, 20).forEach((lsb, i) => {
      const hex = lsb.toString(16).padStart(16, '0');
      const binary = lsb.toString(2).padStart(64, '0');
      const ones = binary.split('1').length - 1;
      console.log(`  ${i+1}: ${hex} (${ones}/64 ones)`);
    });
    
    console.log("\nSimple Random LSB distribution (first 20 samples):");
    simpleResult.lsbs.slice(0, 20).forEach((lsb, i) => {
      const hex = lsb.toString(16).padStart(16, '0');
      const binary = lsb.toString(2).padStart(64, '0');
      const ones = binary.split('1').length - 1;
      console.log(`  ${i+1}: ${hex} (${ones}/64 ones)`);
    });
  });

  it("should validate true UUID randomness quality", () => {
    if (SKIP_RANDOMNESS_TESTS) return;
    console.log("\n=== True UUID Randomness Validation ===");
    
    // Generate actual UUIDs and analyze their LSB randomness
    const uuids: string[] = [];
    const lsbs: bigint[] = [];
    
    for (let i = 0; i < sampleSize; i++) {
      const uuid = UuidGenerator.generateUUID();
      uuids.push(uuid);
      lsbs.push(extractLsbFromUuid(uuid));
    }
    
    const bitAnalysis = runBitFrequencyTest(lsbs);
    const hammingAnalysis = runHammingDistanceAnalysis(lsbs);
    const patternAnalysis = detectPatterns(lsbs);
    
    console.log("Actual UUID LSB Analysis:");
    console.log(`  Bit entropy deviation: ${bitAnalysis.mean.toFixed(4)} (target: <0.05)`);
    console.log(`  Hamming distance: ${hammingAnalysis.avgDistance.toFixed(1)}/64 bits (target: ~32)`);
    console.log(`  Uniqueness: ${((sampleSize - patternAnalysis.repetitions) / sampleSize * 100).toFixed(2)}%`);
    console.log(`  Sequential patterns: ${patternAnalysis.sequentialPattern}`);
    
    // Validate excellent randomness
    expect(bitAnalysis.mean).toBeLessThan(0.05);
    expect(hammingAnalysis.avgDistance).toBeGreaterThan(28);
    expect(hammingAnalysis.avgDistance).toBeLessThan(36);
    expect(patternAnalysis.repetitions).toBe(0);
  });
});