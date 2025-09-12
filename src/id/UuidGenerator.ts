/**
 * Port of trex-paxos UUIDGenerator.java; do not change semantics.
 * 
 * SPDX-FileCopyrightText: 2024 - 2025 Simon Massey
 * SPDX-License-Identifier: Apache-2.0
 * 
 * The server-side TypeScript UUID library lets us create a UUID from two longs.
 * In the most significant long we put the time in milliseconds.
 * We then bit shift the time left by 20 bits and mask in a counter.
 * This gives us good time based ordering within a single process.
 * The ordering across servers will naturally be subject to clock drift between hosts.
 *
 * For the least significant bits we use a pure random long to make the UUIDs globally unique.
 *
 * The RFC for time based UUIDs suggest that 10M UUIDs per second can be generated. 
 * This class gets about 0.5M per second (similar to the Java version).
 */

import { randomBytes } from 'crypto';

/**
 * A trick from the core UUID class is to use holder class to defer initialization until needed.
 */
class LazyRandom {
  private static _instance: LazyRandom;
  private readonly secureRandom: () => Buffer;

  private constructor() {
    // Use Node.js crypto.randomBytes for secure random generation
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
    // Convert 8 bytes to a signed 64-bit integer (like Java's long)
    return buffer.readBigInt64BE();
  }
}

export class UuidGenerator {
  private static sequence = 0n;
  private static readonly COUNTER_MASK = 0xFFFFFn; // 20 bits: 0xFFFFF

  /**
   * This takes the Unix/server-side TypeScript epoch time in milliseconds, bit shifts it left by 20 bits, 
   * and then masks in the least significant 20 bits of the local counter. 
   * That gives us a million unique values per millisecond.
   */
  private static epochTimeThenCounterMsb(): bigint {
    const currentMillis = BigInt(Date.now());
    // Take the least significant 20 bits from our atomic sequence
    UuidGenerator.sequence = UuidGenerator.sequence + 1n;
    const counter20bits = UuidGenerator.sequence & UuidGenerator.COUNTER_MASK;
    return (currentMillis << 20n) | counter20bits;
  }

  /**
   * There is no guarantee that the time+counter of the most significant long will be unique across processes.
   * In the lower 64 bits we use a random long. This makes it improbable to get any collisions across processes.
   * Within a given process we will have good time based ordering.
   */
  public static generateUUID(): string {
    // As the most significant bits use ms time then counter for sub-millisecond ordering.
    const msb = UuidGenerator.epochTimeThenCounterMsb();
    // As the least significant bits use a random long which will give us uniqueness across processes.
    const lsb = LazyRandom.instance.nextLong();
    
    return UuidGenerator.formatUUID(msb, lsb);
  }

  /**
   * Format two 64-bit values as a standard UUID string.
   * Matches the format that Java's UUID.toString() would produce.
   */
  private static formatUUID(msb: bigint, lsb: bigint): string {
    // Convert to unsigned 64-bit values for proper formatting
    const msbUnsigned = msb < 0n ? msb + (1n << 64n) : msb;
    const lsbUnsigned = lsb < 0n ? lsb + (1n << 64n) : lsb;
    
    // Extract the components following UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    const timeLow = (msbUnsigned >> 32n) & 0xFFFFFFFFn;
    const timeMid = (msbUnsigned >> 16n) & 0xFFFFn;
    const timeHiAndVersion = msbUnsigned & 0xFFFFn;
    const clockSeqHiAndReserved = (lsbUnsigned >> 56n) & 0xFFn;
    const clockSeqLow = (lsbUnsigned >> 48n) & 0xFFn;
    const node = lsbUnsigned & 0xFFFFFFFFFFFFn;

    const hex = (value: bigint, length: number): string => 
      value.toString(16).padStart(length, '0');

    return `${hex(timeLow, 8)}-${hex(timeMid, 4)}-${hex(timeHiAndVersion, 4)}-${hex(clockSeqHiAndReserved, 2)}${hex(clockSeqLow, 2)}-${hex(node, 12)}`;
  }
}