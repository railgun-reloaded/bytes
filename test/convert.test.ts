import assert from 'node:assert/strict'
import { test } from 'node:test'

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

test('stripHexPrefix removes 0x and leaves prefixless input alone', () => {
  assert.equal(stripHexPrefix('0xabcd'), 'abcd')
  assert.equal(stripHexPrefix('abcd'), 'abcd')
  assert.equal(stripHexPrefix('0x'), '')
  assert.equal(stripHexPrefix(''), '')
})

test('hexToBytes decodes with and without 0x prefix', () => {
  assert.deepEqual(hexToBytes('00ff80'), new Uint8Array([0, 255, 128]))
  assert.deepEqual(hexToBytes('0x00ff80'), new Uint8Array([0, 255, 128]))
})

test('hexToBytes accepts mixed case', () => {
  assert.deepEqual(hexToBytes('AbCdEf01'), new Uint8Array([0xab, 0xcd, 0xef, 0x01]))
})

test('hexToBytes empty input returns empty array', () => {
  assert.deepEqual(hexToBytes(''), new Uint8Array(0))
  assert.deepEqual(hexToBytes('0x'), new Uint8Array(0))
})

test('hexToBytes rejects odd-length input', () => {
  assert.throws(() => hexToBytes('abc'), /odd-length/)
  assert.throws(() => hexToBytes('0xabc'), /odd-length/)
})

test('hexToBytes rejects non-hex characters', () => {
  assert.throws(() => hexToBytes('zz'), /non-hex/)
  assert.throws(() => hexToBytes('0xgg'), /non-hex/)
})

test('bytesToHex produces lowercase hex without prefix by default', () => {
  assert.equal(bytesToHex(new Uint8Array([0, 255, 128])), '00ff80')
})

test('bytesToHex respects prefix option', () => {
  assert.equal(bytesToHex(new Uint8Array([0xab]), { prefix: true }), '0xab')
  assert.equal(bytesToHex(new Uint8Array([0xab]), { prefix: false }), 'ab')
})

test('bytesToHex empty array returns empty string', () => {
  assert.equal(bytesToHex(new Uint8Array(0)), '')
  assert.equal(bytesToHex(new Uint8Array(0), { prefix: true }), '0x')
})

test('hex and bytes round-trip', () => {
  const hex = '00112233445566778899aabbccddeeff'
  assert.equal(bytesToHex(hexToBytes(hex)), hex)
  const bytes = new Uint8Array([1, 2, 3, 4, 5])
  assert.deepEqual(hexToBytes(bytesToHex(bytes)), bytes)
})

test('bytesToBigInt decodes big-endian', () => {
  assert.equal(bytesToBigInt(new Uint8Array([0x01, 0x02])), 0x0102n)
  assert.equal(bytesToBigInt(new Uint8Array([0xff])), 0xffn)
  assert.equal(bytesToBigInt(new Uint8Array(0)), 0n)
})

test('bigIntToBytes encodes big-endian with fixed length', () => {
  assert.deepEqual(bigIntToBytes(0x0102n, 2), new Uint8Array([0x01, 0x02]))
  assert.deepEqual(bigIntToBytes(0x0102n, 4), new Uint8Array([0x00, 0x00, 0x01, 0x02]))
  assert.deepEqual(bigIntToBytes(0n, 3), new Uint8Array([0, 0, 0]))
})

test('bigIntToBytes throws on overflow', () => {
  assert.throws(() => bigIntToBytes(0x100n, 1), /does not fit/)
  assert.throws(() => bigIntToBytes(0x10000n, 2), /does not fit/)
})

test('bigIntToBytes throws on negative values', () => {
  assert.throws(() => bigIntToBytes(-1n, 4), /negative/)
})

test('bigIntToBytes throws on invalid byteLength', () => {
  assert.throws(() => bigIntToBytes(0n, -1), /invalid byteLength/)
  assert.throws(() => bigIntToBytes(0n, 1.5), /invalid byteLength/)
})

test('bigint round-trips through bytes', () => {
  const value = 0xdeadbeefcafebabe1234567890abcdefn
  assert.equal(bytesToBigInt(bigIntToBytes(value, 32)), value)
})

test('bigIntToHex produces zero-padded hex', () => {
  assert.equal(bigIntToHex(0xabn, 4), '000000ab')
  assert.equal(bigIntToHex(0xabn, 4, { prefix: true }), '0x000000ab')
  assert.equal(bigIntToHex(0n, 1), '00')
})

test('bigIntToHex throws on overflow', () => {
  assert.throws(() => bigIntToHex(0x10000n, 1))
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

test('hexlify coerces hex strings', () => {
  assert.equal(hexlify('0xAbCd'), 'abcd')
  assert.equal(hexlify('abcd'), 'abcd')
  assert.equal(hexlify(''), '')
})

test('hexlify coerces bigints and numbers with even-length padding', () => {
  assert.equal(hexlify(0n), '00')
  assert.equal(hexlify(0xabn), 'ab')
  assert.equal(hexlify(0xabcn), '0abc')
  assert.equal(hexlify(255), 'ff')
  assert.equal(hexlify(256), '0100')
})

test('hexlify coerces byte arrays', () => {
  assert.equal(hexlify(new Uint8Array([0xab, 0xcd])), 'abcd')
  assert.equal(hexlify(new Uint8Array(0)), '')
})

test('hexlify rejects non-hex strings and negative numbers', () => {
  assert.throws(() => hexlify('zzz'), /non-hex/)
  assert.throws(() => hexlify(-1n), /negative/)
  assert.throws(() => hexlify(-1), /negative/)
})
