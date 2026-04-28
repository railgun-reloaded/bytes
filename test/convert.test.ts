import { test } from 'brittle'

import {
  BigIntOverflowError,
  InvalidByteLengthError,
  InvalidHexError,
  NegativeValueError,
  OddLengthHexError,
  bigIntToBytes,
  bigIntToHex,
  bytesToBigInt,
  bytesToHex,
  hexToBytes,
  padBytesLeft,
  stripHexPrefix,
} from '../src/index'

test('stripHexPrefix removes 0x and leaves prefixless input alone', (t) => {
  t.is(stripHexPrefix('0xabcd'), 'abcd')
  t.is(stripHexPrefix('abcd'), 'abcd')
  t.is(stripHexPrefix('0x'), '')
  t.is(stripHexPrefix(''), '')
})

test('stripHexPrefix only strips a single leading 0x', (t) => {
  // Defensive: if a string accidentally has multiple prefixes, only the
  // first is removed. Documents the actual behavior.
  t.is(stripHexPrefix('0x0xabcd'), '0xabcd')
})

test('stripHexPrefix is case-sensitive on the prefix', (t) => {
  // Uppercase 0X is intentionally not stripped; Ethereum convention is
  // lowercase 0x and propagating the upper case input would surprise downstream.
  t.is(stripHexPrefix('0Xabcd'), '0Xabcd')
})

test('stripHexPrefix does not strip non-leading 0x', (t) => {
  t.is(stripHexPrefix('ab0xcd'), 'ab0xcd')
})

test('hexToBytes decodes with and without 0x prefix', (t) => {
  t.alike(hexToBytes('00ff80'), new Uint8Array([0, 255, 128]))
  t.alike(hexToBytes('0x00ff80'), new Uint8Array([0, 255, 128]))
})

test('hexToBytes accepts mixed case', (t) => {
  t.alike(hexToBytes('AbCdEf01'), new Uint8Array([0xab, 0xcd, 0xef, 0x01]))
})

test('hexToBytes accepts each hex character class boundary', (t) => {
  // Locks in the charCode decoder ranges: '0'-'9', 'A'-'F', 'a'-'f'.
  t.alike(hexToBytes('09'), new Uint8Array([0x09]))
  t.alike(hexToBytes('0a'), new Uint8Array([0x0a]))
  t.alike(hexToBytes('0f'), new Uint8Array([0x0f]))
  t.alike(hexToBytes('0A'), new Uint8Array([0x0a]))
  t.alike(hexToBytes('0F'), new Uint8Array([0x0f]))
  t.alike(hexToBytes('00'), new Uint8Array([0x00]))
  t.alike(hexToBytes('ff'), new Uint8Array([0xff]))
  t.alike(hexToBytes('FF'), new Uint8Array([0xff]))
})

test('hexToBytes empty input returns empty array', (t) => {
  t.alike(hexToBytes(''), new Uint8Array(0))
  t.alike(hexToBytes('0x'), new Uint8Array(0))
})

test('hexToBytes handles 32-byte input (commitment hash size)', (t) => {
  const hex = 'ff'.repeat(32)
  const result = hexToBytes(hex)
  t.is(result.length, 32)
  t.is(result[0], 0xff)
  t.is(result[31], 0xff)
})

test('hexToBytes handles a long input (1024 bytes)', (t) => {
  // Exercises the charCode loop at scale — checks for off-by-one errors.
  const bytes = new Uint8Array(1024).fill(0xab)
  const hex = 'ab'.repeat(1024)
  t.alike(hexToBytes(hex), bytes)
})

test('hexToBytes throws OddLengthHexError on odd-length input', (t) => {
  t.exception(() => hexToBytes('abc'), OddLengthHexError)
  t.exception(() => hexToBytes('0xabc'), OddLengthHexError)
})

test('hexToBytes throws InvalidHexError on non-hex characters', (t) => {
  t.exception(() => hexToBytes('zz'), InvalidHexError)
  t.exception(() => hexToBytes('0xgg'), InvalidHexError)
})

test('hexToBytes throws InvalidHexError on each non-hex char-class boundary', (t) => {
  // Characters adjacent to the valid hex ranges. If the charCode decoder ever
  // drifts (off-by-one on the boundary checks), one of these will pass when
  // it shouldn't.
  for (const bad of ['/', ':', '@', 'G', '`', 'g', '!', '~']) {
    // pad to even length so length isn't the trigger
    t.exception(() => hexToBytes(`${bad}${bad}`), InvalidHexError, `should reject "${bad}"`)
  }
})

test('hexToBytes throws InvalidHexError on whitespace', (t) => {
  t.exception(() => hexToBytes('ab cd'), InvalidHexError)
  t.exception(() => hexToBytes(' abcd'), InvalidHexError)
  t.exception(() => hexToBytes('abcd '), InvalidHexError)
  t.exception(() => hexToBytes('ab\ncd'), InvalidHexError)
  t.exception(() => hexToBytes('ab\tcd'), InvalidHexError)
})

test('hexToBytes throws InvalidHexError on unicode characters', (t) => {
  // Multi-byte unicode chars must not slip through. charCodeAt returns the
  // surrogate code unit, which is well outside hex-char ranges.
  t.exception(() => hexToBytes('0xab💩cd'), InvalidHexError)
  t.exception(() => hexToBytes('0xabñcd'), InvalidHexError)
})

test('hexToBytes prefers InvalidHexError over OddLengthHexError', (t) => {
  // 'z' is both odd-length and non-hex; non-hex is the more accurate error
  // and must be reported first.
  t.exception(() => hexToBytes('z'), InvalidHexError)
})

test('hexToBytes prefers InvalidHexError on odd-length non-hex strings', (t) => {
  // Odd-length AND every char is non-hex; should still surface as InvalidHex.
  t.exception(() => hexToBytes('zzz'), InvalidHexError)
})

test('hexToBytes with allowOddLength left-pads odd-length input', (t) => {
  t.alike(hexToBytes('abc', { allowOddLength: true }), new Uint8Array([0x0a, 0xbc]))
  t.alike(hexToBytes('0xabc', { allowOddLength: true }), new Uint8Array([0x0a, 0xbc]))
  // Real-world Subsquid case: '0x4c47554' represents the value 0x04c47554
  t.alike(
    hexToBytes('0x4c47554', { allowOddLength: true }),
    new Uint8Array([0x04, 0xc4, 0x75, 0x54])
  )
})

test('hexToBytes with allowOddLength leaves even-length input unchanged', (t) => {
  t.alike(hexToBytes('abcd', { allowOddLength: true }), new Uint8Array([0xab, 0xcd]))
})

test('hexToBytes with allowOddLength still throws InvalidHexError on non-hex', (t) => {
  t.exception(() => hexToBytes('zzz', { allowOddLength: true }), InvalidHexError)
  t.exception(() => hexToBytes('z', { allowOddLength: true }), InvalidHexError)
})

test('hexToBytes with allowOddLength: false explicitly rejects odd length', (t) => {
  t.exception(() => hexToBytes('abc', { allowOddLength: false }), OddLengthHexError)
})

test('hexToBytes with empty input ignores allowOddLength', (t) => {
  t.alike(hexToBytes('', { allowOddLength: true }), new Uint8Array(0))
  t.alike(hexToBytes('0x', { allowOddLength: true }), new Uint8Array(0))
})

test('hexToBytes with allowOddLength does NOT restore dropped leading bytes', (t) => {
  // Locks in the documented limitation: the option only handles a single
  // dropped leading nibble, not whole dropped leading zero bytes. A 32-byte
  // hash that arrives missing two leading zero hex chars is still 30 bytes
  // — callers that need a fixed length must follow up with padBytesLeft.
  t.is(hexToBytes('0xab', { allowOddLength: true }).length, 1)
  t.is(hexToBytes('ab', { allowOddLength: true }).length, 1)
  // Round-trip via padBytesLeft is the documented escape hatch.
  t.alike(
    padBytesLeft(hexToBytes('ab', { allowOddLength: true }), 32),
    padBytesLeft(new Uint8Array([0xab]), 32)
  )
})

test('bytesToHex produces lowercase hex without prefix by default', (t) => {
  t.is(bytesToHex(new Uint8Array([0, 255, 128])), '00ff80')
})

test('bytesToHex respects prefix option', (t) => {
  t.is(bytesToHex(new Uint8Array([0xab]), { prefix: true }), '0xab')
  t.is(bytesToHex(new Uint8Array([0xab]), { prefix: false }), 'ab')
  t.is(bytesToHex(new Uint8Array([0xab]), {}), 'ab')
})

test('bytesToHex empty array returns empty string', (t) => {
  t.is(bytesToHex(new Uint8Array(0)), '')
  t.is(bytesToHex(new Uint8Array(0), { prefix: true }), '0x')
})

test('bytesToHex single-digit nibbles are zero-padded', (t) => {
  // Every nibble that requires padding: 0x0, 0x01, 0x0a, 0x0f.
  t.is(bytesToHex(new Uint8Array([0])), '00')
  t.is(bytesToHex(new Uint8Array([1])), '01')
  t.is(bytesToHex(new Uint8Array([0x0a])), '0a')
  t.is(bytesToHex(new Uint8Array([0x0f])), '0f')
  t.is(bytesToHex(new Uint8Array([0x10])), '10')
})

test('bytesToHex covers every byte value 0..255 (lookup-table correctness)', (t) => {
  // The precomputed BYTE_TO_HEX table is built once at module load. If it ever
  // gets corrupted or off-by-one, this test fails for every entry.
  const all = new Uint8Array(256)
  for (let i = 0; i < 256; i += 1) all[i] = i
  const hex = bytesToHex(all)
  t.is(hex.length, 512)
  for (let i = 0; i < 256; i += 1) {
    const expected = i.toString(16).padStart(2, '0')
    const actual = hex.substring(i * 2, i * 2 + 2)
    t.is(actual, expected, `byte 0x${expected} should encode as "${expected}"`)
  }
})

test('bytesToHex handles long input (1024 bytes)', (t) => {
  const bytes = new Uint8Array(1024).fill(0xcd)
  t.is(bytesToHex(bytes), 'cd'.repeat(1024))
})

test('hex and bytes round-trip', (t) => {
  const hex = '00112233445566778899aabbccddeeff'
  t.is(bytesToHex(hexToBytes(hex)), hex)
  const bytes = new Uint8Array([1, 2, 3, 4, 5])
  t.alike(hexToBytes(bytesToHex(bytes)), bytes)
})

test('hex and bytes round-trip across a range of sizes', (t) => {
  for (const size of [0, 1, 2, 4, 16, 20, 32, 64, 200]) {
    const bytes = new Uint8Array(size)
    for (let i = 0; i < size; i += 1) bytes[i] = (i * 31 + 7) & 0xff
    t.alike(hexToBytes(bytesToHex(bytes)), bytes, `size=${size}`)
  }
})

test('bytesToBigInt decodes big-endian', (t) => {
  t.is(bytesToBigInt(new Uint8Array([0x01, 0x02])), 0x0102n)
  t.is(bytesToBigInt(new Uint8Array([0xff])), 0xffn)
  t.is(bytesToBigInt(new Uint8Array(0)), 0n)
})

test('bytesToBigInt is big-endian (not little-endian)', (t) => {
  // Explicit ordering check — most significant byte at index 0.
  t.is(bytesToBigInt(new Uint8Array([0x01, 0x00])), 0x100n)
  t.is(bytesToBigInt(new Uint8Array([0x00, 0x01])), 0x1n)
})

test('bytesToBigInt handles the full uint256 value space', (t) => {
  const max32 = new Uint8Array(32).fill(0xff)
  t.is(
    bytesToBigInt(max32),
    0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn
  )
})

test('bytesToBigInt skips leading zeros', (t) => {
  t.is(bytesToBigInt(new Uint8Array([0, 0, 0, 0x42])), 0x42n)
  t.is(bytesToBigInt(new Uint8Array([0, 0, 0, 0])), 0n)
})

test('bigIntToBytes encodes big-endian with fixed length', (t) => {
  t.alike(bigIntToBytes(0x0102n, 2), new Uint8Array([0x01, 0x02]))
  t.alike(bigIntToBytes(0x0102n, 4), new Uint8Array([0x00, 0x00, 0x01, 0x02]))
  t.alike(bigIntToBytes(0n, 3), new Uint8Array([0, 0, 0]))
})

test('bigIntToBytes byteLength=0 accepts only 0n', (t) => {
  t.alike(bigIntToBytes(0n, 0), new Uint8Array(0))
  t.exception(() => bigIntToBytes(1n, 0), BigIntOverflowError)
})

test('bigIntToBytes overflow check at exact boundary', (t) => {
  // n bytes can hold values 0 .. 2^(n*8) - 1
  t.alike(bigIntToBytes(0xffn, 1), new Uint8Array([0xff]))
  t.exception(() => bigIntToBytes(0x100n, 1), BigIntOverflowError)

  t.alike(bigIntToBytes(0xffffn, 2), new Uint8Array([0xff, 0xff]))
  t.exception(() => bigIntToBytes(0x10000n, 2), BigIntOverflowError)

  // 32-byte uint256 max
  const uint256Max = (1n << 256n) - 1n
  t.is(bigIntToBytes(uint256Max, 32).length, 32)
  t.exception(() => bigIntToBytes(uint256Max + 1n, 32), BigIntOverflowError)
})

test('bigIntToBytes throws NegativeValueError on negative values', (t) => {
  t.exception(() => bigIntToBytes(-1n, 4), NegativeValueError)
  t.exception(() => bigIntToBytes(-(1n << 64n), 32), NegativeValueError)
})

test('bigIntToBytes throws InvalidByteLengthError on invalid byteLength', (t) => {
  t.exception(() => bigIntToBytes(0n, -1), InvalidByteLengthError)
  t.exception(() => bigIntToBytes(0n, 1.5), InvalidByteLengthError)
  t.exception(() => bigIntToBytes(0n, NaN), InvalidByteLengthError)
  t.exception(() => bigIntToBytes(0n, Infinity), InvalidByteLengthError)
  t.exception(() => bigIntToBytes(0n, -Infinity), InvalidByteLengthError)
})

test('bigint round-trips through bytes across a range of values', (t) => {
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
    t.is(bytesToBigInt(bigIntToBytes(value, byteLength)), value, `value=${value}`)
  }
})

test('bigIntToHex produces zero-padded hex', (t) => {
  t.is(bigIntToHex(0xabn, 4), '000000ab')
  t.is(bigIntToHex(0xabn, 4, { prefix: true }), '0x000000ab')
  t.is(bigIntToHex(0n, 1), '00')
})

test('bigIntToHex byteLength=0', (t) => {
  t.is(bigIntToHex(0n, 0), '')
  t.is(bigIntToHex(0n, 0, { prefix: true }), '0x')
  t.exception(() => bigIntToHex(1n, 0), BigIntOverflowError)
})

test('bigIntToHex throws BigIntOverflowError on overflow', (t) => {
  t.exception(() => bigIntToHex(0x10000n, 1), BigIntOverflowError)
  t.exception(() => bigIntToHex((1n << 256n), 32), BigIntOverflowError)
})

test('bigIntToHex propagates InvalidByteLengthError from bigIntToBytes', (t) => {
  // bigIntToHex delegates to bigIntToBytes, so the validation error must
  // surface unchanged. The JSDoc enumerates this @throws.
  t.exception(() => bigIntToHex(1n, -1), InvalidByteLengthError)
  t.exception(() => bigIntToHex(1n, 1.5), InvalidByteLengthError)
  t.exception(() => bigIntToHex(1n, NaN), InvalidByteLengthError)
  t.exception(() => bigIntToHex(1n, Infinity), InvalidByteLengthError)
})

test('bigIntToHex propagates NegativeValueError', (t) => {
  t.exception(() => bigIntToHex(-1n, 4), NegativeValueError)
})

test('bigIntToHex large value (uint256)', (t) => {
  // Picked to exercise mid-byte boundaries.
  const value = 0xc5cf39211876fb5e5884327fa56fc0b75n
  t.is(
    bigIntToHex(value, 32),
    '0000000000000000000000000000000c5cf39211876fb5e5884327fa56fc0b75'
  )
})

test('padBytesLeft pads short input with zeros', (t) => {
  t.alike(
    padBytesLeft(new Uint8Array([0xab, 0xcd]), 4),
    new Uint8Array([0, 0, 0xab, 0xcd])
  )
})

test('padBytesLeft returns input unchanged when already at or above target', (t) => {
  const bytes = new Uint8Array([1, 2, 3, 4])
  t.is(padBytesLeft(bytes, 4), bytes)
  t.is(padBytesLeft(bytes, 2), bytes)
})

test('padBytesLeft target=0 returns input unchanged', (t) => {
  const bytes = new Uint8Array([1, 2])
  t.is(padBytesLeft(bytes, 0), bytes)
  const empty = new Uint8Array(0)
  t.is(padBytesLeft(empty, 0), empty)
})

test('padBytesLeft empty input pads to target', (t) => {
  t.alike(padBytesLeft(new Uint8Array(0), 4), new Uint8Array([0, 0, 0, 0]))
})

test('padBytesLeft does not mutate the input', (t) => {
  const original = new Uint8Array([1, 2])
  const snapshot = new Uint8Array(original)
  padBytesLeft(original, 8)
  t.alike(original, snapshot, 'input was not mutated')
})

test('padBytesLeft throws InvalidByteLengthError on invalid targetLength', (t) => {
  // Mirrors bigIntToBytes validation — both helpers reject non-integer,
  // negative, NaN, and Infinity targetLength rather than silently
  // producing an unexpected result.
  const bytes = new Uint8Array([1, 2])
  t.exception(() => padBytesLeft(bytes, -1), InvalidByteLengthError)
  t.exception(() => padBytesLeft(bytes, 1.5), InvalidByteLengthError)
  t.exception(() => padBytesLeft(bytes, NaN), InvalidByteLengthError)
  t.exception(() => padBytesLeft(bytes, Infinity), InvalidByteLengthError)
  t.exception(() => padBytesLeft(bytes, -Infinity), InvalidByteLengthError)
})
