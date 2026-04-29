import { test } from 'brittle'

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

test('BytesError extends Error', (t) => {
  const err = new BytesError('InvalidHex', 'test')
  t.ok(err instanceof Error)
  t.ok(err instanceof BytesError)
})

test('BytesError carries the code as a readonly field', (t) => {
  for (const code of codes) {
    const err = new BytesError(code, 'msg')
    t.is(err.code, code, `code=${code}`)
  }
})

test('BytesError sets .name to "BytesError" regardless of code', (t) => {
  for (const code of codes) {
    t.is(new BytesError(code).name, 'BytesError')
  }
})

test('BytesError propagates the message', (t) => {
  const err = new BytesError('InvalidHex', 'something went wrong')
  t.is(err.message, 'something went wrong')
})

test('BytesError message is optional', (t) => {
  const err = new BytesError('InvalidHex')
  t.is(err.message, '')
  t.is(err.code, 'InvalidHex')
})
