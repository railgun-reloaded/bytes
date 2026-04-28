import { test } from 'brittle'

import {
  bigIntToBytes,
  bigIntToHex,
  bytesToBigInt,
  bytesToHex,
  hexToBytes,
  hexlify,
  padBytesLeft,
  stripHexPrefix,
} from '../src/index'

test('stripHexPrefix removes 0x and leaves prefixless input alone', (t) => {
  t.is(stripHexPrefix('0xabcd'), 'abcd')
  t.is(stripHexPrefix('abcd'), 'abcd')
  t.is(stripHexPrefix('0x'), '')
  t.is(stripHexPrefix(''), '')
})

test('hexToBytes decodes with and without 0x prefix', (t) => {
  t.alike(hexToBytes('00ff80'), new Uint8Array([0, 255, 128]))
  t.alike(hexToBytes('0x00ff80'), new Uint8Array([0, 255, 128]))
})

test('hexToBytes accepts mixed case', (t) => {
  t.alike(hexToBytes('AbCdEf01'), new Uint8Array([0xab, 0xcd, 0xef, 0x01]))
})

test('hexToBytes empty input returns empty array', (t) => {
  t.alike(hexToBytes(''), new Uint8Array(0))
  t.alike(hexToBytes('0x'), new Uint8Array(0))
})

test('hexToBytes rejects odd-length input', (t) => {
  t.exception(() => hexToBytes('abc'), /odd-length/)
  t.exception(() => hexToBytes('0xabc'), /odd-length/)
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

test('hexToBytes with allowOddLength still rejects non-hex characters', (t) => {
  t.exception(() => hexToBytes('zzz', { allowOddLength: true }), /non-hex/)
})

test('hexToBytes rejects non-hex characters', (t) => {
  t.exception(() => hexToBytes('zz'), /non-hex/)
  t.exception(() => hexToBytes('0xgg'), /non-hex/)
})

test('bytesToHex produces lowercase hex without prefix by default', (t) => {
  t.is(bytesToHex(new Uint8Array([0, 255, 128])), '00ff80')
})

test('bytesToHex respects prefix option', (t) => {
  t.is(bytesToHex(new Uint8Array([0xab]), { prefix: true }), '0xab')
  t.is(bytesToHex(new Uint8Array([0xab]), { prefix: false }), 'ab')
})

test('bytesToHex empty array returns empty string', (t) => {
  t.is(bytesToHex(new Uint8Array(0)), '')
  t.is(bytesToHex(new Uint8Array(0), { prefix: true }), '0x')
})

test('hex and bytes round-trip', (t) => {
  const hex = '00112233445566778899aabbccddeeff'
  t.is(bytesToHex(hexToBytes(hex)), hex)
  const bytes = new Uint8Array([1, 2, 3, 4, 5])
  t.alike(hexToBytes(bytesToHex(bytes)), bytes)
})

test('bytesToBigInt decodes big-endian', (t) => {
  t.is(bytesToBigInt(new Uint8Array([0x01, 0x02])), 0x0102n)
  t.is(bytesToBigInt(new Uint8Array([0xff])), 0xffn)
  t.is(bytesToBigInt(new Uint8Array(0)), 0n)
})

test('bigIntToBytes encodes big-endian with fixed length', (t) => {
  t.alike(bigIntToBytes(0x0102n, 2), new Uint8Array([0x01, 0x02]))
  t.alike(bigIntToBytes(0x0102n, 4), new Uint8Array([0x00, 0x00, 0x01, 0x02]))
  t.alike(bigIntToBytes(0n, 3), new Uint8Array([0, 0, 0]))
})

test('bigIntToBytes throws on overflow', (t) => {
  t.exception(() => bigIntToBytes(0x100n, 1), /does not fit/)
  t.exception(() => bigIntToBytes(0x10000n, 2), /does not fit/)
})

test('bigIntToBytes throws on negative values', (t) => {
  t.exception(() => bigIntToBytes(-1n, 4), /negative/)
})

test('bigIntToBytes throws on invalid byteLength', (t) => {
  t.exception(() => bigIntToBytes(0n, -1), /invalid byteLength/)
  t.exception(() => bigIntToBytes(0n, 1.5), /invalid byteLength/)
})

test('bigint round-trips through bytes', (t) => {
  const value = 0xdeadbeefcafebabe1234567890abcdefn
  t.is(bytesToBigInt(bigIntToBytes(value, 32)), value)
})

test('bigIntToHex produces zero-padded hex', (t) => {
  t.is(bigIntToHex(0xabn, 4), '000000ab')
  t.is(bigIntToHex(0xabn, 4, { prefix: true }), '0x000000ab')
  t.is(bigIntToHex(0n, 1), '00')
})

test('bigIntToHex throws on overflow', (t) => {
  t.exception(() => bigIntToHex(0x10000n, 1))
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

test('hexlify coerces hex strings', (t) => {
  t.is(hexlify('0xAbCd'), 'abcd')
  t.is(hexlify('abcd'), 'abcd')
  t.is(hexlify(''), '')
})

test('hexlify coerces bigints and numbers with even-length padding', (t) => {
  t.is(hexlify(0n), '00')
  t.is(hexlify(0xabn), 'ab')
  t.is(hexlify(0xabcn), '0abc')
  t.is(hexlify(255), 'ff')
  t.is(hexlify(256), '0100')
})

test('hexlify coerces byte arrays', (t) => {
  t.is(hexlify(new Uint8Array([0xab, 0xcd])), 'abcd')
  t.is(hexlify(new Uint8Array(0)), '')
})

test('hexlify rejects non-hex strings and negative numbers', (t) => {
  t.exception(() => hexlify('zzz'), /non-hex/)
  t.exception(() => hexlify(-1n), /negative/)
  t.exception(() => hexlify(-1), /negative/)
})
