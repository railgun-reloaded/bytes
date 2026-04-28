import {
  BigIntOverflowError,
  InvalidByteLengthError,
  InvalidHexError,
  NegativeValueError,
  OddLengthHexError,
} from './errors'

const HEX_CHARACTERS = /^[0-9a-fA-F]*$/

// Precomputed byte → 2-char hex lookup. Indexing this beats running
// `.toString(16).padStart(2, '0')` per byte; the difference compounds on
// large arrays (commitment trees, batch encodings).
const BYTE_TO_HEX = Array.from(
  { length: 256 },
  (_, i) => i.toString(16).padStart(2, '0')
)

/**
 * Decodes a single hex character (by charCode) into its nibble value 0-15.
 * Used in the `hexToBytes` hot loop in place of `parseInt(_, 16)`, which is
 * both slower and unnecessarily permissive (accepts signs, whitespace, etc).
 * @param charCode - The character code (e.g. from `String.charCodeAt`).
 * @returns The nibble value 0-15, or -1 if `charCode` is not a hex character.
 */
const charCodeToNibble = (charCode: number): number => {
  // '0'-'9' → 0-9
  if (charCode >= 48 && charCode <= 57) return charCode - 48
  // 'A'-'F' → 10-15
  if (charCode >= 65 && charCode <= 70) return charCode - 55
  // 'a'-'f' → 10-15
  if (charCode >= 97 && charCode <= 102) return charCode - 87
  return -1
}

/**
 * Strips a leading `0x` prefix from a hex string if present.
 * @param hex - Hex string, optionally prefixed with `0x`.
 * @returns The hex string without a `0x` prefix.
 */
const stripHexPrefix = (hex: string): string => {
  return hex.startsWith('0x') ? hex.slice(2) : hex
}

/**
 * Converts a hex string to a `Uint8Array`. Accepts input with or without a
 * leading `0x` prefix. Strings containing non-hex characters are always
 * rejected. Odd-length strings are rejected by default; pass
 * `{ allowOddLength: true }` to left-pad odd-length input with a single
 * leading zero nibble before decoding (use only for upstream sources that
 * are known to drop leading-zero nibbles, e.g. some indexer JSON payloads).
 *
 * Validates character set first so inputs like `'z'` produce an
 * `InvalidHexError` rather than the misleading `OddLengthHexError`.
 *
 * Note: `allowOddLength` only restores a single dropped leading nibble. It
 * does NOT restore dropped leading zero bytes — an indexer that strips
 * `0x00ab...` to `0xab...` will produce a shorter byte array than the
 * caller may expect. Callers that require a fixed output length should
 * follow up with `padBytesLeft(result, expectedByteLength)`.
 * @param hex - Hex string to convert.
 * @param options - Decoding options.
 * @param options.allowOddLength - When `true`, left-pad odd-length input
 * with one leading zero nibble instead of throwing. Defaults to `false`.
 * @returns Byte array decoded from the hex string. Empty input returns an
 * empty `Uint8Array`.
 * @throws {InvalidHexError} If the input contains non-hex characters.
 * @throws {OddLengthHexError} If the input has odd length and
 * `allowOddLength` is not `true`.
 */
const hexToBytes = (hex: string, options: { allowOddLength?: boolean } = {}): Uint8Array => {
  let stripped = stripHexPrefix(hex)
  if (stripped.length === 0) {
    return new Uint8Array(0)
  }
  if (!HEX_CHARACTERS.test(stripped)) {
    throw new InvalidHexError('hexToBytes: input contains non-hex characters')
  }
  if (stripped.length % 2 !== 0) {
    if (options.allowOddLength !== true) {
      throw new OddLengthHexError(`hexToBytes: odd-length hex string (length=${stripped.length})`)
    }
    stripped = `0${stripped}`
  }

  const bytes = new Uint8Array(stripped.length / 2)
  for (let i = 0, j = 0; i < bytes.length; i += 1) {
    const high = charCodeToNibble(stripped.charCodeAt(j++))
    const low = charCodeToNibble(stripped.charCodeAt(j++))
    // Defense-in-depth: the upstream regex check (HEX_CHARACTERS) guarantees
    // both nibbles are valid, but a future refactor that reorders or removes
    // that check must not silently corrupt output. Without this guard,
    // (-1 << 4) | -1 coerces into the Uint8Array as 0xff.
    if (high < 0 || low < 0) {
      throw new InvalidHexError('hexToBytes: input contains non-hex characters')
    }
    bytes[i] = (high << 4) | low
  }
  return bytes
}

/**
 * Converts a `Uint8Array` to a lowercase hex string.
 * @param bytes - Byte array to encode.
 * @param options - Encoding options.
 * @param options.prefix - When `true`, prepends `0x` to the result. Defaults to `false`.
 * @returns Hex string representation of the byte array.
 */
const bytesToHex = (bytes: Uint8Array, options: { prefix?: boolean } = {}): string => {
  let hex = ''
  for (let i = 0; i < bytes.length; i += 1) {
    hex += BYTE_TO_HEX[bytes[i]!]
  }
  return options.prefix === true ? `0x${hex}` : hex
}

/**
 * Interprets a byte array as a big-endian unsigned integer.
 * @param bytes - Byte array to decode.
 * @returns The unsigned integer value represented by the byte array. An empty
 * input returns `0n`.
 */
const bytesToBigInt = (bytes: Uint8Array): bigint => {
  let result = 0n
  for (let i = 0; i < bytes.length; i += 1) {
    result = (result << 8n) | BigInt(bytes[i]!)
  }
  return result
}

/**
 * Encodes an unsigned bigint as a fixed-length big-endian byte array.
 * @param value - Non-negative bigint value to encode.
 * @param byteLength - Exact length of the resulting byte array, in bytes.
 * @returns Big-endian byte array of length `byteLength`.
 * @throws {NegativeValueError} If `value` is negative.
 * @throws {InvalidByteLengthError} If `byteLength` is not a non-negative integer.
 * @throws {BigIntOverflowError} If `value` does not fit in `byteLength` bytes.
 */
const bigIntToBytes = (value: bigint, byteLength: number): Uint8Array => {
  if (value < 0n) {
    throw new NegativeValueError('bigIntToBytes: negative values are not supported')
  }
  if (!Number.isInteger(byteLength) || byteLength < 0) {
    throw new InvalidByteLengthError(`bigIntToBytes: invalid byteLength ${byteLength}`)
  }

  const bytes = new Uint8Array(byteLength)
  let remaining = value
  for (let i = byteLength - 1; i >= 0; i -= 1) {
    bytes[i] = Number(remaining & 0xffn)
    remaining >>= 8n
  }
  if (remaining !== 0n) {
    throw new BigIntOverflowError(`bigIntToBytes: value does not fit in ${byteLength} bytes`)
  }
  return bytes
}

/**
 * Encodes an unsigned bigint as a fixed-length hex string.
 * @param value - Non-negative bigint value to encode.
 * @param byteLength - Target length of the encoded value, in bytes (result
 * will be `byteLength * 2` hex characters, not counting any prefix).
 * @param options - Encoding options.
 * @param options.prefix - When `true`, prepends `0x` to the result. Defaults to `false`.
 * @returns Zero-padded lowercase hex string.
 * @throws {NegativeValueError} If `value` is negative.
 * @throws {InvalidByteLengthError} If `byteLength` is not a non-negative integer.
 * @throws {BigIntOverflowError} If `value` does not fit in `byteLength` bytes.
 */
const bigIntToHex = (
  value: bigint,
  byteLength: number,
  options: { prefix?: boolean } = {}
): string => {
  return bytesToHex(bigIntToBytes(value, byteLength), options)
}

/**
 * Left-pads a byte array with zero bytes to a target length. Returns the
 * input unchanged (same reference) when it is already at least
 * `targetLength` bytes.
 * @param bytes - Byte array to pad.
 * @param targetLength - Desired minimum length in bytes; must be a
 * non-negative integer.
 * @returns Byte array of at least `targetLength` bytes.
 * @throws {InvalidByteLengthError} If `targetLength` is not a non-negative
 * integer (mirrors `bigIntToBytes` validation).
 */
const padBytesLeft = (bytes: Uint8Array, targetLength: number): Uint8Array => {
  if (!Number.isInteger(targetLength) || targetLength < 0) {
    throw new InvalidByteLengthError(`padBytesLeft: invalid targetLength ${targetLength}`)
  }
  if (bytes.length >= targetLength) {
    return bytes
  }
  const padded = new Uint8Array(targetLength)
  padded.set(bytes, targetLength - bytes.length)
  return padded
}

export {
  bigIntToBytes,
  bigIntToHex,
  bytesToBigInt,
  bytesToHex,
  hexToBytes,
  padBytesLeft,
  stripHexPrefix,
}
