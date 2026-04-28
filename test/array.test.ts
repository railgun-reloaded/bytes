import { test } from 'brittle'

import {
  chunk,
  combine,
} from '../src/index'

test('chunk splits evenly when length is a multiple of size', (t) => {
  t.alike(
    chunk(new Uint8Array([1, 2, 3, 4, 5, 6]), 2),
    [new Uint8Array([1, 2]), new Uint8Array([3, 4]), new Uint8Array([5, 6])]
  )
})

test('chunk leaves a short trailing chunk when length is not a multiple', (t) => {
  t.alike(
    chunk(new Uint8Array([1, 2, 3, 4, 5]), 2),
    [new Uint8Array([1, 2]), new Uint8Array([3, 4]), new Uint8Array([5])]
  )
})

test('chunk with size larger than input returns a single chunk', (t) => {
  t.alike(
    chunk(new Uint8Array([1, 2, 3]), 10),
    [new Uint8Array([1, 2, 3])]
  )
})

test('chunk with empty input returns empty array', (t) => {
  t.alike(chunk(new Uint8Array(0), 4), [])
})

test('chunk rejects non-positive or non-integer size', (t) => {
  t.exception(() => chunk(new Uint8Array([1, 2]), 0), /invalid size/)
  t.exception(() => chunk(new Uint8Array([1, 2]), -1), /invalid size/)
  t.exception(() => chunk(new Uint8Array([1, 2]), 1.5), /invalid size/)
})

test('combine concatenates chunks in order', (t) => {
  t.alike(
    combine([new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5, 6])]),
    new Uint8Array([1, 2, 3, 4, 5, 6])
  )
})

test('combine with empty list returns empty array', (t) => {
  t.alike(combine([]), new Uint8Array(0))
})

test('combine handles empty chunks alongside populated ones', (t) => {
  t.alike(
    combine([new Uint8Array([1, 2]), new Uint8Array(0), new Uint8Array([3])]),
    new Uint8Array([1, 2, 3])
  )
})

test('chunk and combine round-trip', (t) => {
  const original = new Uint8Array([10, 20, 30, 40, 50, 60, 70])
  t.alike(combine(chunk(original, 3)), original)
})
