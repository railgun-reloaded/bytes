import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { BytesErrorCode } from '../src/index'
import { BytesError } from '../src/index'

const codes: BytesErrorCode[] = [
  'OddLengthHex',
  'InvalidHex',
  'BigIntOverflow',
  'NegativeValue',
  'InvalidByteLength',
  'InvalidChunkSize',
]

test('BytesError extends Error', () => {
  const err = new BytesError('InvalidHex', 'test')
  assert.ok(err instanceof Error)
  assert.ok(err instanceof BytesError)
})

test('BytesError carries the code as a readonly field', () => {
  for (const code of codes) {
    const err = new BytesError(code, 'msg')
    assert.equal(err.code, code, `code=${code}`)
  }
})

test('BytesError sets .name to "BytesError" regardless of code', () => {
  for (const code of codes) {
    assert.equal(new BytesError(code).name, 'BytesError')
  }
})

test('BytesError propagates the message', () => {
  const err = new BytesError('InvalidHex', 'something went wrong')
  assert.equal(err.message, 'something went wrong')
})

test('BytesError message is optional', () => {
  const err = new BytesError('InvalidHex')
  assert.equal(err.message, '')
  assert.equal(err.code, 'InvalidHex')
})
