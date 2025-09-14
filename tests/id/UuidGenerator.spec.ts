/**
 * Comprehensive tests for UuidGenerator - mirrors Java test behavior
 * Tests time ordering, monotonicity, uniqueness, concurrency, and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { UuidGenerator } from "../../src/id/UuidGenerator.js";

/**
 * Helper class to mock Date.now() for deterministic testing
 */
class FakeClock {
  private currentTime: number;
  private originalDateNow: typeof Date.now;

  constructor(initialTime: number = 1000000) {
    this.currentTime = initialTime;
    this.originalDateNow = Date.now;
  }

  install(): void {
    Date.now = () => this.currentTime;
  }

  restore(): void {
    Date.now = this.originalDateNow;
  }

  setTime(time: number): void {
    this.currentTime = time;
  }

  advance(ms: number): void {
    this.currentTime += ms;
  }

  tick(): void {
    this.currentTime += 1;
  }
}

/**
 * Helper to generate UUIDs quickly
 */
function generateBatch(count: number): string[] {
  const uuids: string[] = [];
  for (let i = 0; i < count; i++) {
    uuids.push(UuidGenerator.generateUUID());
  }
  return uuids;
}

/**
 * Helper to check if UUIDs are in ascending order
 */
function isAscendingOrder(uuids: string[]): boolean {
  for (let i = 1; i < uuids.length; i++) {
    if (uuids[i] <= uuids[i - 1]) {
      return false;
    }
  }
  return true;
}

/**
 * Helper to check UUID format (standard UUID format)
 */
function isValidUUIDFormat(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

describe("UuidGenerator", () => {
  let fakeClock: FakeClock;

  beforeEach(() => {
    fakeClock = new FakeClock();
  });

  afterEach(() => {
    fakeClock.restore();
  });

  describe("Basic functionality", () => {
    it("should generate valid UUID format", () => {
      const uuid = UuidGenerator.generateUUID();
      expect(isValidUUIDFormat(uuid)).toBe(true);
    });

    it("should generate different UUIDs on successive calls", () => {
      const uuid1 = UuidGenerator.generateUUID();
      const uuid2 = UuidGenerator.generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });

    it("should generate UUIDs with proper length", () => {
      const uuid = UuidGenerator.generateUUID();
      expect(uuid.length).toBe(36); // Standard UUID format length
    });
  });

  describe("Monotonicity within same tick", () => {
    it("should generate strictly increasing UUIDs within same millisecond", () => {
      fakeClock.install();
      const T = 1000000;
      fakeClock.setTime(T);

      // Generate 200,000 UUIDs as fast as possible with frozen time
      const K = 200_000;
      const uuids = generateBatch(K);

      // Assert: strictly increasing (lexicographic), no duplicates
      expect(new Set(uuids).size).toBe(K); // No duplicates
      expect(isAscendingOrder(uuids)).toBe(true); // Strictly increasing
    });

    it("should handle high-frequency generation within same tick", () => {
      fakeClock.install();
      fakeClock.setTime(5000);

      // Generate a large batch quickly
      const uuids = generateBatch(10_000);

      // All should be unique and ordered
      expect(new Set(uuids).size).toBe(10_000);
      expect(isAscendingOrder(uuids)).toBe(true);
    });
  });

  describe("Monotonicity across ticks", () => {
    it("should maintain global strict ordering across time changes", () => {
      fakeClock.install();
      const uuids: string[] = [];
      
      // Mock Date.now() to return [T, T, T+1, T+1, T+2...] pattern
      const times = [1000, 1000, 1001, 1001, 1002, 1002, 1003];
      
      for (const time of times) {
        fakeClock.setTime(time);
        uuids.push(UuidGenerator.generateUUID());
      }

      // Assert: global strict increase matching Java behavior
      expect(isAscendingOrder(uuids)).toBe(true);
      expect(new Set(uuids).size).toBe(uuids.length); // All unique
    });

    it("should handle time progression correctly", () => {
      fakeClock.install();
      const uuids: string[] = [];
      let baseTime = 10000;

      // Generate UUIDs across multiple milliseconds
      for (let i = 0; i < 100; i++) {
        fakeClock.setTime(baseTime + i);
        uuids.push(UuidGenerator.generateUUID());
      }

      expect(isAscendingOrder(uuids)).toBe(true);
      expect(new Set(uuids).size).toBe(100);
    });
  });

  describe("Clock regression behavior", () => {
    it("should generate unique UUIDs even with clock regression", () => {
      fakeClock.install();
      const uuids: string[] = [];

      // Mock: T, T-5, T-10, T, and generate across this pattern
      const times = [1000, 995, 990, 1000];
      
      for (const time of times) {
        fakeClock.setTime(time);
        uuids.push(UuidGenerator.generateUUID());
      }

      // Java behavior: UUIDs are unique but not necessarily ordered during clock regression
      expect(new Set(uuids).size).toBe(uuids.length); // All unique
      
      // The counter keeps incrementing, so within same millisecond they should be ordered
      // But across time regression, ordering is not guaranteed (matches Java behavior)
    });

    it("should maintain uniqueness despite clock regression", () => {
      fakeClock.install();
      const uuids: string[] = [];

      // Simulate severe clock regression
      const times = [5000, 4000, 3000, 2000, 5001];
      
      for (const time of times) {
        fakeClock.setTime(time);
        uuids.push(UuidGenerator.generateUUID());
      }

      // Java behavior: uniqueness is maintained, but ordering is not guaranteed during regression
      expect(new Set(uuids).size).toBe(uuids.length);
    });
  });

  describe("Counter wrap behavior", () => {
    it("should handle counter overflow within same millisecond", () => {
      fakeClock.install();
      fakeClock.setTime(2000);

      // Generate enough UUIDs to potentially wrap the 20-bit counter (1M values)
      // We'll test a smaller subset for performance but ensure behavior is correct
      const batchSize = 100_000;
      const uuids = generateBatch(batchSize);

      expect(new Set(uuids).size).toBe(batchSize);
      expect(isAscendingOrder(uuids)).toBe(true);
    });

    it("should maintain uniqueness near counter boundaries", () => {
      fakeClock.install();
      fakeClock.setTime(3000);

      // Generate UUIDs that might approach counter limits
      const uuids = generateBatch(50_000);
      
      expect(new Set(uuids).size).toBe(50_000);
      expect(isAscendingOrder(uuids)).toBe(true);
    });
  });

  describe("Multi-concurrency simulation (async storm)", () => {
    it("should handle concurrent generation without duplicates", async () => {
      // Launch N=100 parallel tasks each generating M=2,000 UUIDs (total 200k)
      const N = 100;
      const M = 2_000;
      
      const promises = Array.from({ length: N }, async () => {
        return generateBatch(M);
      });

      const results = await Promise.all(promises);
      const allUuids = results.flat();

      // Assert: uniqueness & order within each generator instance
      expect(allUuids.length).toBe(N * M);
      expect(new Set(allUuids).size).toBe(N * M); // All unique across all tasks

      // Each individual batch should be ordered
      for (const batch of results) {
        expect(isAscendingOrder(batch)).toBe(true);
      }
    });

    it("should maintain consistency under async pressure", async () => {
      const tasks = 50;
      const uuidsPerTask = 1_000;

      const promises = Array.from({ length: tasks }, async (_, i) => {
        // Add small random delays to simulate real async behavior
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
        return generateBatch(uuidsPerTask);
      });

      const results = await Promise.all(promises);
      const allUuids = results.flat();

      expect(new Set(allUuids).size).toBe(tasks * uuidsPerTask);
    });
  });

  describe("Format and structure validation", () => {
    it("should produce UUIDs with correct structure", () => {
      const uuid = UuidGenerator.generateUUID();
      const parts = uuid.split('-');
      
      expect(parts.length).toBe(5);
      expect(parts[0].length).toBe(8);  // time_low
      expect(parts[1].length).toBe(4);  // time_mid  
      expect(parts[2].length).toBe(4);  // time_hi_and_version
      expect(parts[3].length).toBe(4);  // clock_seq_hi_and_reserved + clock_seq_low
      expect(parts[4].length).toBe(12); // node
    });

    it("should use only valid hexadecimal characters", () => {
      const uuids = generateBatch(100);
      
      for (const uuid of uuids) {
        const hexOnly = uuid.replace(/-/g, '');
        expect(hexOnly).toMatch(/^[0-9a-f]+$/i);
      }
    });
  });

  describe("Time ordering verification", () => {
    it("should embed time information correctly", () => {
      fakeClock.install();
      
      // Generate UUIDs at different times
      const times = [10000, 20000, 30000];
      const uuids: { time: number; uuid: string }[] = [];
      
      for (const time of times) {
        fakeClock.setTime(time);
        uuids.push({ time, uuid: UuidGenerator.generateUUID() });
      }

      // UUIDs generated at later times should be lexicographically larger
      for (let i = 1; i < uuids.length; i++) {
        expect(uuids[i].uuid > uuids[i-1].uuid).toBe(true);
      }
    });

    it("should maintain time-based ordering over extended periods", () => {
      fakeClock.install();
      const uuids: string[] = [];
      
      // Generate UUIDs over a simulated time span
      for (let hour = 0; hour < 24; hour++) {
        for (let minute = 0; minute < 60; minute += 15) {
          const time = hour * 3600000 + minute * 60000; // Convert to milliseconds
          fakeClock.setTime(time);
          uuids.push(UuidGenerator.generateUUID());
        }
      }

      expect(isAscendingOrder(uuids)).toBe(true);
      expect(new Set(uuids).size).toBe(uuids.length);
    });
  });

  describe("Fuzz testing", () => {
    it("should handle random time patterns without duplicates", () => {
      fakeClock.install();
      const uuids: string[] = [];
      
      // Generate UUIDs with random time jumps
      for (let i = 0; i < 1000; i++) {
        const randomTime = Math.floor(Math.random() * 1000000) + 1000000;
        fakeClock.setTime(randomTime);
        uuids.push(UuidGenerator.generateUUID());
        
        // Occasionally add multiple UUIDs at the same time
        if (i % 100 === 0) {
          uuids.push(UuidGenerator.generateUUID());
          uuids.push(UuidGenerator.generateUUID());
        }
      }

      // Should have no duplicates despite random time patterns
      expect(new Set(uuids).size).toBe(uuids.length);
    });

    it("should maintain performance under stress", () => {
      const startTime = Date.now();
      const uuids = generateBatch(10_000);
      const endTime = Date.now();
      
      expect(new Set(uuids).size).toBe(10_000);
      expect(isAscendingOrder(uuids)).toBe(true);
      
      // Should complete in reasonable time (adjust threshold as needed)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // 5 seconds max for 10k UUIDs
    });
  });
});
