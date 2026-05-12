import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { BytesErrorCode } from '../src/index'
import {
  BytesError,
  bigIntToBytes,
  bigIntToHex,
  bytesToBigInt,
  bytesToHex,
  hexToBytes,
  padBytesLeft,
  stripHexPrefix,
} from '../src/index'

/**
 * Asserts that `fn` throws a `BytesError` with the given `code`.
 * `assert.throws` only matches by constructor or regex on the message, so it
 * can't discriminate on `code` directly — this helper does the catch-and-check.
 * @param fn - The function expected to throw.
 * @param code - The expected `BytesErrorCode`.
 * @param label - Optional label for the assertion messages.
 */
const expectBytesError = (fn: () => unknown, code: BytesErrorCode, label?: string): void => {
  try {
    fn()
    assert.fail(`${label ?? code}: expected throw, got none`)
  } catch (e) {
    assert.ok(e instanceof BytesError, `${label ?? code}: expected BytesError`)
    assert.equal((e as BytesError).code, code, `${label ?? code}: code mismatch`)
  }
}

test('stripHexPrefix removes 0x and leaves prefixless input alone', () => {
  assert.equal(stripHexPrefix('0xabcd'), 'abcd')
  assert.equal(stripHexPrefix('abcd'), 'abcd')
  assert.equal(stripHexPrefix('0x'), '')
  assert.equal(stripHexPrefix(''), '')
})

test('stripHexPrefix only strips a single leading 0x', () => {
  assert.equal(stripHexPrefix('0x0xabcd'), '0xabcd')
})

test('stripHexPrefix is case-sensitive on the prefix', () => {
  // Uppercase 0X is intentionally not stripped; Ethereum convention is
  // lowercase 0x. Any 0X-prefixed payload that reaches hexToBytes will be
  // rejected by the hex-character check downstream.
  assert.equal(stripHexPrefix('0Xabcd'), '0Xabcd')
})

test('stripHexPrefix does not strip non-leading 0x', () => {
  assert.equal(stripHexPrefix('ab0xcd'), 'ab0xcd')
})

test('hexToBytes decodes with and without 0x prefix', () => {
  assert.deepEqual(hexToBytes('00ff80'), new Uint8Array([0, 255, 128]))
  assert.deepEqual(hexToBytes('0x00ff80'), new Uint8Array([0, 255, 128]))
})

test('hexToBytes accepts mixed case', () => {
  assert.deepEqual(hexToBytes('AbCdEf01'), new Uint8Array([0xab, 0xcd, 0xef, 0x01]))
})

test('hexToBytes accepts each hex character class boundary', () => {
  // Locks in the charCode decoder ranges: '0'-'9', 'A'-'F', 'a'-'f'.
  assert.deepEqual(hexToBytes('09'), new Uint8Array([0x09]))
  assert.deepEqual(hexToBytes('0a'), new Uint8Array([0x0a]))
  assert.deepEqual(hexToBytes('0f'), new Uint8Array([0x0f]))
  assert.deepEqual(hexToBytes('0A'), new Uint8Array([0x0a]))
  assert.deepEqual(hexToBytes('0F'), new Uint8Array([0x0f]))
  assert.deepEqual(hexToBytes('00'), new Uint8Array([0x00]))
  assert.deepEqual(hexToBytes('ff'), new Uint8Array([0xff]))
  assert.deepEqual(hexToBytes('FF'), new Uint8Array([0xff]))
})

test('hexToBytes empty input returns empty array', () => {
  assert.deepEqual(hexToBytes(''), new Uint8Array(0))
  assert.deepEqual(hexToBytes('0x'), new Uint8Array(0))
})

test('hexToBytes handles 32-byte input (commitment hash size)', () => {
  const hex = 'ff'.repeat(32)
  const result = hexToBytes(hex)
  assert.equal(result.length, 32)
  assert.equal(result[0], 0xff)
  assert.equal(result[31], 0xff)
})

test('hexToBytes handles a long input (1024 bytes)', () => {
  // Exercises the charCode loop at scale — checks for off-by-one errors.
  const bytes = new Uint8Array(1024).fill(0xab)
  const hex = 'ab'.repeat(1024)
  assert.deepEqual(hexToBytes(hex), bytes)
})

test('hexToBytes throws OddLengthHex on odd-length input', () => {
  expectBytesError(() => hexToBytes('abc'), 'OddLengthHex')
  expectBytesError(() => hexToBytes('0xabc'), 'OddLengthHex')
})

test('hexToBytes throws InvalidHex on non-hex characters', () => {
  expectBytesError(() => hexToBytes('zz'), 'InvalidHex')
  expectBytesError(() => hexToBytes('0xgg'), 'InvalidHex')
})

test('hexToBytes throws InvalidHex on each non-hex char-class boundary', () => {
  // Characters adjacent to the valid hex ranges. If the charCode decoder
  // ever drifts (off-by-one on the boundary checks), one of these will pass
  // when it shouldn't.
  for (const bad of ['/', ':', '@', 'G', '`', 'g', '!', '~']) {
    expectBytesError(() => hexToBytes(`${bad}${bad}`), 'InvalidHex', `should reject "${bad}"`)
  }
})

test('hexToBytes throws InvalidHex on whitespace', () => {
  expectBytesError(() => hexToBytes('ab cd'), 'InvalidHex')
  expectBytesError(() => hexToBytes(' abcd'), 'InvalidHex')
  expectBytesError(() => hexToBytes('abcd '), 'InvalidHex')
  expectBytesError(() => hexToBytes('ab\ncd'), 'InvalidHex')
  expectBytesError(() => hexToBytes('ab\tcd'), 'InvalidHex')
})

test('hexToBytes throws InvalidHex on unicode characters', () => {
  // Multi-byte unicode chars must not slip through. charCodeAt returns the
  // surrogate code unit, which is well outside hex-char ranges.
  expectBytesError(() => hexToBytes('0xab💩cd'), 'InvalidHex')
  expectBytesError(() => hexToBytes('0xabñcd'), 'InvalidHex')
})

test('hexToBytes prefers InvalidHex over OddLengthHex on single non-hex char', () => {
  // 'z' is both odd-length and non-hex; non-hex is the more accurate error
  // and must be reported first.
  expectBytesError(() => hexToBytes('z'), 'InvalidHex')
})

test('hexToBytes prefers InvalidHex on odd-length all-non-hex strings', () => {
  expectBytesError(() => hexToBytes('zzz'), 'InvalidHex')
})

test('hexToBytes with allowOddLength left-pads odd-length input', () => {
  assert.deepEqual(hexToBytes('abc', { allowOddLength: true }), new Uint8Array([0x0a, 0xbc]))
  assert.deepEqual(hexToBytes('0xabc', { allowOddLength: true }), new Uint8Array([0x0a, 0xbc]))
  // Real-world Subsquid case: '0x4c47554' represents the value 0x04c47554
  assert.deepEqual(
    hexToBytes('0x4c47554', { allowOddLength: true }),
    new Uint8Array([0x04, 0xc4, 0x75, 0x54])
  )
})

test('hexToBytes with allowOddLength leaves even-length input unchanged', () => {
  assert.deepEqual(hexToBytes('abcd', { allowOddLength: true }), new Uint8Array([0xab, 0xcd]))
})

test('hexToBytes with allowOddLength still throws InvalidHex on non-hex', () => {
  expectBytesError(() => hexToBytes('zzz', { allowOddLength: true }), 'InvalidHex')
  expectBytesError(() => hexToBytes('z', { allowOddLength: true }), 'InvalidHex')
})

test('hexToBytes with allowOddLength: false explicitly rejects odd length', () => {
  expectBytesError(() => hexToBytes('abc', { allowOddLength: false }), 'OddLengthHex')
})

test('hexToBytes with empty input ignores allowOddLength', () => {
  assert.deepEqual(hexToBytes('', { allowOddLength: true }), new Uint8Array(0))
  assert.deepEqual(hexToBytes('0x', { allowOddLength: true }), new Uint8Array(0))
})

test('hexToBytes with allowOddLength does NOT restore dropped leading bytes', () => {
  // Locks in the documented limitation: the option only handles a single
  // dropped leading nibble, not whole dropped leading zero bytes. A 32-byte
  // hash that arrives missing two leading zero hex chars is still 30 bytes
  // — callers that need a fixed length must follow up with padBytesLeft.
  assert.equal(hexToBytes('0xab', { allowOddLength: true }).length, 1)
  assert.equal(hexToBytes('ab', { allowOddLength: true }).length, 1)
  assert.deepEqual(
    padBytesLeft(hexToBytes('ab', { allowOddLength: true }), 32),
    padBytesLeft(new Uint8Array([0xab]), 32)
  )
})

test('bytesToHex produces lowercase hex without prefix by default', () => {
  assert.equal(bytesToHex(new Uint8Array([0, 255, 128])), '00ff80')
})

test('bytesToHex respects prefix option', () => {
  assert.equal(bytesToHex(new Uint8Array([0xab]), { prefix: true }), '0xab')
  assert.equal(bytesToHex(new Uint8Array([0xab]), { prefix: false }), 'ab')
  assert.equal(bytesToHex(new Uint8Array([0xab]), {}), 'ab')
})

test('bytesToHex empty array returns empty string', () => {
  assert.equal(bytesToHex(new Uint8Array(0)), '')
  assert.equal(bytesToHex(new Uint8Array(0), { prefix: true }), '0x')
})

test('bytesToHex single-digit nibbles are zero-padded', () => {
  assert.equal(bytesToHex(new Uint8Array([0])), '00')
  assert.equal(bytesToHex(new Uint8Array([1])), '01')
  assert.equal(bytesToHex(new Uint8Array([0x0a])), '0a')
  assert.equal(bytesToHex(new Uint8Array([0x0f])), '0f')
  assert.equal(bytesToHex(new Uint8Array([0x10])), '10')
})

test('bytesToHex covers every byte value 0..255 (lookup-table correctness)', () => {
  // The precomputed BYTE_TO_HEX table is built once at module load. If it
  // ever gets corrupted or off-by-one, this test fails for every entry.
  const all = new Uint8Array(256)
  for (let i = 0; i < 256; i += 1) all[i] = i
  const hex = bytesToHex(all)
  assert.equal(hex.length, 512)
  for (let i = 0; i < 256; i += 1) {
    const expected = i.toString(16).padStart(2, '0')
    const actual = hex.substring(i * 2, i * 2 + 2)
    assert.equal(actual, expected, `byte 0x${expected} should encode as "${expected}"`)
  }
})

test('bytesToHex handles long input (1024 bytes)', () => {
  const bytes = new Uint8Array(1024).fill(0xcd)
  assert.equal(bytesToHex(bytes), 'cd'.repeat(1024))
})

test('hex and bytes round-trip', () => {
  const hex = '00112233445566778899aabbccddeeff'
  assert.equal(bytesToHex(hexToBytes(hex)), hex)
  const bytes = new Uint8Array([1, 2, 3, 4, 5])
  assert.deepEqual(hexToBytes(bytesToHex(bytes)), bytes)
})

test('hex and bytes round-trip across a range of sizes', () => {
  for (const size of [0, 1, 2, 4, 16, 20, 32, 64, 200]) {
    const bytes = new Uint8Array(size)
    for (let i = 0; i < size; i += 1) bytes[i] = (i * 31 + 7) & 0xff
    assert.deepEqual(hexToBytes(bytesToHex(bytes)), bytes, `size=${size}`)
  }
})

test('bytesToBigInt decodes big-endian', () => {
  assert.equal(bytesToBigInt(new Uint8Array([0x01, 0x02])), 0x0102n)
  assert.equal(bytesToBigInt(new Uint8Array([0xff])), 0xffn)
  assert.equal(bytesToBigInt(new Uint8Array(0)), 0n)
})

test('bytesToBigInt is big-endian (not little-endian)', () => {
  assert.equal(bytesToBigInt(new Uint8Array([0x01, 0x00])), 0x100n)
  assert.equal(bytesToBigInt(new Uint8Array([0x00, 0x01])), 0x1n)
})

test('bytesToBigInt handles the full uint256 value space', () => {
  const max32 = new Uint8Array(32).fill(0xff)
  assert.equal(
    bytesToBigInt(max32),
    0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn
  )
})

test('bytesToBigInt skips leading zeros', () => {
  assert.equal(bytesToBigInt(new Uint8Array([0, 0, 0, 0x42])), 0x42n)
  assert.equal(bytesToBigInt(new Uint8Array([0, 0, 0, 0])), 0n)
})

test('bigIntToBytes encodes big-endian with fixed length', () => {
  assert.deepEqual(bigIntToBytes(0x0102n, 2), new Uint8Array([0x01, 0x02]))
  assert.deepEqual(bigIntToBytes(0x0102n, 4), new Uint8Array([0x00, 0x00, 0x01, 0x02]))
  assert.deepEqual(bigIntToBytes(0n, 3), new Uint8Array([0, 0, 0]))
})

test('bigIntToBytes byteLength=0 accepts only 0n', () => {
  assert.deepEqual(bigIntToBytes(0n, 0), new Uint8Array(0))
  expectBytesError(() => bigIntToBytes(1n, 0), 'BigIntOverflow')
})

test('bigIntToBytes overflow check at exact boundary', () => {
  assert.deepEqual(bigIntToBytes(0xffn, 1), new Uint8Array([0xff]))
  expectBytesError(() => bigIntToBytes(0x100n, 1), 'BigIntOverflow')

  assert.deepEqual(bigIntToBytes(0xffffn, 2), new Uint8Array([0xff, 0xff]))
  expectBytesError(() => bigIntToBytes(0x10000n, 2), 'BigIntOverflow')

  const uint256Max = (1n << 256n) - 1n
  assert.equal(bigIntToBytes(uint256Max, 32).length, 32)
  expectBytesError(() => bigIntToBytes(uint256Max + 1n, 32), 'BigIntOverflow')
})

test('bigIntToBytes throws NegativeValue on negative values', () => {
  expectBytesError(() => bigIntToBytes(-1n, 4), 'NegativeValue')
  expectBytesError(() => bigIntToBytes(-(1n << 64n), 32), 'NegativeValue')
})

test('bigIntToBytes throws InvalidByteLength on invalid byteLength', () => {
  expectBytesError(() => bigIntToBytes(0n, -1), 'InvalidByteLength')
  expectBytesError(() => bigIntToBytes(0n, 1.5), 'InvalidByteLength')
  expectBytesError(() => bigIntToBytes(0n, NaN), 'InvalidByteLength')
  expectBytesError(() => bigIntToBytes(0n, Infinity), 'InvalidByteLength')
  expectBytesError(() => bigIntToBytes(0n, -Infinity), 'InvalidByteLength')
})

test('bigint round-trips through bytes across a range of values', () => {
  const cases = [
    0n,
    1n,
    255n,
    256n,
    0xffffn,
    0x10000n,
    0xdeadbeefcafebabe1234567890abcdefn,
    (1n << 200n) - 1n,
    (1n << 256n) - 1n,
  ]
  for (const value of cases) {
    const byteLength = Math.max(1, Math.ceil(value.toString(16).length / 2))
    assert.equal(bytesToBigInt(bigIntToBytes(value, byteLength)), value, `value=${value}`)
  }
})

test('bigIntToHex produces zero-padded hex', () => {
  assert.equal(bigIntToHex(0xabn, 4), '000000ab')
  assert.equal(bigIntToHex(0xabn, 4, { prefix: true }), '0x000000ab')
  assert.equal(bigIntToHex(0n, 1), '00')
})

test('bigIntToHex byteLength=0', () => {
  assert.equal(bigIntToHex(0n, 0), '')
  assert.equal(bigIntToHex(0n, 0, { prefix: true }), '0x')
  expectBytesError(() => bigIntToHex(1n, 0), 'BigIntOverflow')
})

test('bigIntToHex throws BigIntOverflow on overflow', () => {
  expectBytesError(() => bigIntToHex(0x10000n, 1), 'BigIntOverflow')
  expectBytesError(() => bigIntToHex((1n << 256n), 32), 'BigIntOverflow')
})

test('bigIntToHex propagates InvalidByteLength from bigIntToBytes', () => {
  // bigIntToHex delegates to bigIntToBytes, so the validation error must
  // surface unchanged. The JSDoc enumerates this @throws.
  expectBytesError(() => bigIntToHex(1n, -1), 'InvalidByteLength')
  expectBytesError(() => bigIntToHex(1n, 1.5), 'InvalidByteLength')
  expectBytesError(() => bigIntToHex(1n, NaN), 'InvalidByteLength')
  expectBytesError(() => bigIntToHex(1n, Infinity), 'InvalidByteLength')
})

test('bigIntToHex propagates NegativeValue', () => {
  expectBytesError(() => bigIntToHex(-1n, 4), 'NegativeValue')
})

test('bigIntToHex large value (uint256)', () => {
  const value = 0xc5cf39211876fb5e5884327fa56fc0b75n
  assert.equal(
    bigIntToHex(value, 32),
    '0000000000000000000000000000000c5cf39211876fb5e5884327fa56fc0b75'
  )
})

test('padBytesLeft pads short input with zeros', () => {
  assert.deepEqual(
    padBytesLeft(new Uint8Array([0xab, 0xcd]), 4),
    new Uint8Array([0, 0, 0xab, 0xcd])
  )
})

test('padBytesLeft returns input unchanged when already at or above target', () => {
  const bytes = new Uint8Array([1, 2, 3, 4])
  assert.equal(padBytesLeft(bytes, 4), bytes)
  assert.equal(padBytesLeft(bytes, 2), bytes)
})

test('padBytesLeft target=0 returns input unchanged', () => {
  const bytes = new Uint8Array([1, 2])
  assert.equal(padBytesLeft(bytes, 0), bytes)
  const empty = new Uint8Array(0)
  assert.equal(padBytesLeft(empty, 0), empty)
})

test('padBytesLeft empty input pads to target', () => {
  assert.deepEqual(padBytesLeft(new Uint8Array(0), 4), new Uint8Array([0, 0, 0, 0]))
})

test('padBytesLeft does not mutate the input', () => {
  const original = new Uint8Array([1, 2])
  const snapshot = new Uint8Array(original)
  padBytesLeft(original, 8)
  assert.deepEqual(original, snapshot, 'input was not mutated')
})

test('padBytesLeft throws InvalidByteLength on invalid targetLength', () => {
  // Mirrors bigIntToBytes validation — both helpers reject non-integer,
  // negative, NaN, and Infinity targetLength rather than silently
  // producing an unexpected result.
  const bytes = new Uint8Array([1, 2])
  expectBytesError(() => padBytesLeft(bytes, -1), 'InvalidByteLength')
  expectBytesError(() => padBytesLeft(bytes, 1.5), 'InvalidByteLength')
  expectBytesError(() => padBytesLeft(bytes, NaN), 'InvalidByteLength')
  expectBytesError(() => padBytesLeft(bytes, Infinity), 'InvalidByteLength')
  expectBytesError(() => padBytesLeft(bytes, -Infinity), 'InvalidByteLength')
})

test('padBytesLeft strict mode pads short input with zeros', () => {
  assert.deepEqual(
    padBytesLeft(new Uint8Array([0xab, 0xcd]), 4, { strict: true }),
    new Uint8Array([0, 0, 0xab, 0xcd])
  )
})

test('padBytesLeft strict mode returns input unchanged when length matches target exactly', () => {
  const bytes = new Uint8Array([1, 2, 3, 4])
  assert.equal(padBytesLeft(bytes, 4, { strict: true }), bytes)
})

test('padBytesLeft strict mode throws ByteLengthExceeded when input is longer than target', () => {
  // The whole point of strict mode: never silently pass through an
  // over-length input.
  const bytes = new Uint8Array([1, 2, 3, 4, 5])
  expectBytesError(() => padBytesLeft(bytes, 4, { strict: true }), 'ByteLengthExceeded')
  expectBytesError(() => padBytesLeft(bytes, 0, { strict: true }), 'ByteLengthExceeded')
})

test('padBytesLeft strict mode empty input pads to target', () => {
  assert.deepEqual(
    padBytesLeft(new Uint8Array(0), 4, { strict: true }),
    new Uint8Array([0, 0, 0, 0])
  )
})

test('padBytesLeft strict mode target=0 with empty input returns input unchanged', () => {
  const empty = new Uint8Array(0)
  assert.equal(padBytesLeft(empty, 0, { strict: true }), empty)
})

test('padBytesLeft strict mode does not mutate the input', () => {
  const original = new Uint8Array([1, 2])
  const snapshot = new Uint8Array(original)
  padBytesLeft(original, 8, { strict: true })
  assert.deepEqual(original, snapshot, 'input was not mutated')
})

test('padBytesLeft strict mode throws InvalidByteLength on invalid targetLength', () => {
  // Validation runs before the strict overflow check; same codes as loose mode.
  const bytes = new Uint8Array([1, 2])
  expectBytesError(() => padBytesLeft(bytes, -1, { strict: true }), 'InvalidByteLength')
  expectBytesError(() => padBytesLeft(bytes, 1.5, { strict: true }), 'InvalidByteLength')
  expectBytesError(() => padBytesLeft(bytes, NaN, { strict: true }), 'InvalidByteLength')
  expectBytesError(() => padBytesLeft(bytes, Infinity, { strict: true }), 'InvalidByteLength')
  expectBytesError(() => padBytesLeft(bytes, -Infinity, { strict: true }), 'InvalidByteLength')
})

test('padBytesLeft strict: false matches loose default behavior', () => {
  // Explicit strict: false is the same as omitting the option.
  const longInput = new Uint8Array([1, 2, 3, 4, 5])
  assert.equal(padBytesLeft(longInput, 4, { strict: false }), longInput)
})
