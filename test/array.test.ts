import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { BytesErrorCode } from '../src/index.js'
import {
  BytesError,
  chunk,
  combine,
} from '../src/index.js'

/**
 * Asserts that `fn` throws a `BytesError` with the given `code`.
 * @param fn - The function expected to throw.
 * @param code - The expected `BytesErrorCode`.
 */
const expectBytesError = (fn: () => unknown, code: BytesErrorCode): void => {
  try {
    fn()
    assert.fail(`${code}: expected throw, got none`)
  } catch (e) {
    assert.ok(e instanceof BytesError, `${code}: expected BytesError`)
    assert.equal((e as BytesError).code, code, `${code}: code mismatch`)
  }
}

test('chunk splits evenly when length is a multiple of size', () => {
  assert.deepEqual(
    chunk(new Uint8Array([1, 2, 3, 4, 5, 6]), 2),
    [new Uint8Array([1, 2]), new Uint8Array([3, 4]), new Uint8Array([5, 6])]
  )
})

test('chunk leaves a short trailing chunk when length is not a multiple', () => {
  assert.deepEqual(
    chunk(new Uint8Array([1, 2, 3, 4, 5]), 2),
    [new Uint8Array([1, 2]), new Uint8Array([3, 4]), new Uint8Array([5])]
  )
})

test('chunk with size larger than input returns a single chunk', () => {
  assert.deepEqual(
    chunk(new Uint8Array([1, 2, 3]), 10),
    [new Uint8Array([1, 2, 3])]
  )
})

test('chunk with size=1 returns one chunk per byte', () => {
  assert.deepEqual(
    chunk(new Uint8Array([1, 2, 3]), 1),
    [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])]
  )
})

test('chunk with size equal to length returns single chunk', () => {
  assert.deepEqual(
    chunk(new Uint8Array([1, 2, 3, 4]), 4),
    [new Uint8Array([1, 2, 3, 4])]
  )
})

test('chunk with empty input returns empty array', () => {
  assert.deepEqual(chunk(new Uint8Array(0), 4), [])
})

test('chunk throws InvalidChunkSize on non-positive or non-integer size', () => {
  expectBytesError(() => chunk(new Uint8Array([1, 2]), 0), 'InvalidChunkSize')
  expectBytesError(() => chunk(new Uint8Array([1, 2]), -1), 'InvalidChunkSize')
  expectBytesError(() => chunk(new Uint8Array([1, 2]), 1.5), 'InvalidChunkSize')
  expectBytesError(() => chunk(new Uint8Array([1, 2]), NaN), 'InvalidChunkSize')
  expectBytesError(() => chunk(new Uint8Array([1, 2]), Infinity), 'InvalidChunkSize')
})

test('chunk does not mutate the input', () => {
  const original = new Uint8Array([1, 2, 3, 4, 5])
  const snapshot = new Uint8Array(original)
  chunk(original, 2)
  assert.deepEqual(original, snapshot)
})

test('chunk returns independent slices (mutating output does not affect input)', () => {
  const original = new Uint8Array([1, 2, 3, 4])
  const chunks = chunk(original, 2)
  chunks[0]![0] = 99
  assert.equal(original[0], 1, 'input first byte should still be 1')
})

test('combine concatenates chunks in order', () => {
  assert.deepEqual(
    combine([new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5, 6])]),
    new Uint8Array([1, 2, 3, 4, 5, 6])
  )
})

test('combine with empty list returns empty array', () => {
  assert.deepEqual(combine([]), new Uint8Array(0))
})

test('combine with single chunk returns equivalent bytes', () => {
  assert.deepEqual(combine([new Uint8Array([1, 2, 3])]), new Uint8Array([1, 2, 3]))
})

test('combine handles empty chunks alongside populated ones', () => {
  assert.deepEqual(
    combine([new Uint8Array([1, 2]), new Uint8Array(0), new Uint8Array([3])]),
    new Uint8Array([1, 2, 3])
  )
  assert.deepEqual(
    combine([new Uint8Array(0), new Uint8Array(0), new Uint8Array(0)]),
    new Uint8Array(0)
  )
})

test('combine handles many small chunks', () => {
  const chunks: Uint8Array[] = []
  for (let i = 0; i < 100; i += 1) chunks.push(new Uint8Array([i]))
  const result = combine(chunks)
  assert.equal(result.length, 100)
  assert.equal(result[0], 0)
  assert.equal(result[99], 99)
})

test('combine does not mutate the input chunks', () => {
  const a = new Uint8Array([1, 2])
  const b = new Uint8Array([3, 4])
  const snapshotA = new Uint8Array(a)
  const snapshotB = new Uint8Array(b)
  combine([a, b])
  assert.deepEqual(a, snapshotA)
  assert.deepEqual(b, snapshotB)
})

test('combine returns a fresh buffer (mutating output does not affect input)', () => {
  const a = new Uint8Array([1, 2])
  const result = combine([a])
  result[0] = 99
  assert.equal(a[0], 1, 'input chunk should not be aliased into output')
})

test('chunk and combine round-trip', () => {
  const original = new Uint8Array([10, 20, 30, 40, 50, 60, 70])
  assert.deepEqual(combine(chunk(original, 3)), original)
})

test('chunk and combine round-trip across various sizes', () => {
  const original = new Uint8Array(101)
  for (let i = 0; i < original.length; i += 1) original[i] = (i * 31 + 7) & 0xff
  for (const chunkSize of [1, 2, 5, 10, 32, 64, 100, 101, 200]) {
    assert.deepEqual(combine(chunk(original, chunkSize)), original, `chunkSize=${chunkSize}`)
  }
})
