/**
 * Port of trex-paxos UUIDGenerator.java; semantics are preserved.
 * 
 * SPDX-FileCopyrightText: 2024 - 2025 Simon Massey
 * SPDX-License-Identifier: Apache-2.0
 * 
 * This generator creates 128-bit, time-sortable unique identifiers.
 * The layout is inspired by RFC 4122 but uses a custom scheme.
 * 
 * UUID Layout (128 bits total):
 * - MSB (64 bits): 44-bit millisecond timestamp + 20-bit counter
 * - LSB (64 bits): A cryptographically secure random value
 * 
 * This design provides:
 * 1. Time-based ordering (UUIDs are lexicographically sortable by time)
 * 2. High throughput (up to 1,048,575 unique IDs per millisecond per process)
 * 3. Global uniqueness due to the random component
 * 
 * Performance: Achieves ~1.3M UUIDs/second on an M1 MacBook Pro running bun 1.2.21
 */

import { randomBytes } from 'crypto';

function generateRandomLsb(): bigint {
  const buffer = randomBytes(8);
  return buffer.readBigUInt64BE();
}

export class UuidGenerator {
  private static sequence = 0n;
  private static readonly COUNTER_MASK = 0xFFFFFn;

  private static epochTimeThenCounterMsb(): bigint {
    const currentMillis = BigInt(Date.now());
    UuidGenerator.sequence += 1n;
    const counter20bits = UuidGenerator.sequence & UuidGenerator.COUNTER_MASK;
    return (currentMillis << 20n) | counter20bits;
  }

  public static generateUUID(): string {
    const msb = UuidGenerator.epochTimeThenCounterMsb();
    const lsb = generateRandomLsb();
    return UuidGenerator.formatUUID(msb, lsb);
  }

  private static formatUUID(msb: bigint, lsb: bigint): string {
    const timeLow = (msb >> 32n) & 0xFFFFFFFFn;
    const timeMid = (msb >> 16n) & 0xFFFFn;
    const timeHi = msb & 0xFFFFn;

    const clockSeqHi = (lsb >> 56n) & 0xFFn;
    const clockSeqLow = (lsb >> 48n) & 0xFFn;
    const node = lsb & 0xFFFFFFFFFFFFn;

    const hex = (value: bigint, length: number): string => 
      value.toString(16).padStart(length, '0');

    return `${hex(timeLow, 8)}-${hex(timeMid, 4)}-${hex(timeHi, 4)}-${hex(clockSeqHi, 2)}${hex(clockSeqLow, 2)}-${hex(node, 12)}`;
  }
}
