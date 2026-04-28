import { test } from 'brittle'

import {
  BigIntOverflowError,
  InvalidByteLengthError,
  InvalidChunkSizeError,
  InvalidHexError,
  NegativeValueError,
  OddLengthHexError,
} from '../src/index'

// Each error class is exported and used as the second argument to
// `assert.throws` / `t.exception` in consumer test suites. These tests pin
// the contract: each is a real Error subclass with the correct `name`, the
// `message` is propagated, and `instanceof Error` works (which is what the
// consumer checks rely on).

const cases = [
  { Cls: OddLengthHexError, name: 'OddLengthHexError' },
  { Cls: InvalidHexError, name: 'InvalidHexError' },
  { Cls: BigIntOverflowError, name: 'BigIntOverflowError' },
  { Cls: NegativeValueError, name: 'NegativeValueError' },
  { Cls: InvalidByteLengthError, name: 'InvalidByteLengthError' },
  { Cls: InvalidChunkSizeError, name: 'InvalidChunkSizeError' },
] as const

for (const { Cls, name } of cases) {
  test(`${name} extends Error`, (t) => {
    const err = new Cls('test message')
    t.ok(err instanceof Error, `${name} should be an Error`)
    t.ok(err instanceof Cls, `${name} should be its own class`)
  })

  test(`${name} sets .name correctly`, (t) => {
    const err = new Cls('test message')
    t.is(err.name, name)
  })

  test(`${name} propagates the message`, (t) => {
    const err = new Cls('something went wrong')
    t.is(err.message, 'something went wrong')
  })

  test(`${name} accepts construction without a message`, (t) => {
    // brittle's t.exception(fn, ErrorClass) calls `new Cls()` internally;
    // the class must remain constructible without arguments.
    const err = new Cls()
    t.is(err.name, name)
  })
}
