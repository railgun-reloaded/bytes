const HEX_CHARACTERS = /^[0-9a-fA-F]*$/

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
 * rejected by throwing. Odd-length strings are rejected by default; pass
 * `{ allowOddLength: true }` to left-pad odd-length input with a single
 * leading zero nibble before decoding (use only for upstream sources that
 * are known to drop leading-zero nibbles, e.g. some indexer JSON payloads).
 * @param hex - Hex string to convert.
 * @param options - Decoding options.
 * @param options.allowOddLength - When `true`, left-pad odd-length input
 * with one leading zero nibble instead of throwing. Defaults to `false`.
 * @returns Byte array decoded from the hex string. Empty input returns an
 * empty `Uint8Array`.
 * @throws If the input contains non-hex characters, or has odd length and
 * `allowOddLength` is not `true`.
 */
const hexToBytes = (hex: string, options: { allowOddLength?: boolean } = {}): Uint8Array => {
  let stripped = stripHexPrefix(hex)
  if (stripped.length === 0) {
    return new Uint8Array(0)
  }
  if (stripped.length % 2 !== 0) {
    if (options.allowOddLength !== true) {
      throw new Error(`hexToBytes: odd-length hex string (length=${stripped.length})`)
    }
    stripped = `0${stripped}`
  }
  if (!HEX_CHARACTERS.test(stripped)) {
    throw new Error('hexToBytes: input contains non-hex characters')
  }

  const bytes = new Uint8Array(stripped.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(stripped.substring(i * 2, i * 2 + 2), 16)
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
    hex += bytes[i]!.toString(16).padStart(2, '0')
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
 * @throws If `value` is negative, `byteLength` is negative, or `value` does
 * not fit in `byteLength` bytes.
 */
const bigIntToBytes = (value: bigint, byteLength: number): Uint8Array => {
  if (value < 0n) {
    throw new Error('bigIntToBytes: negative values are not supported')
  }
  if (!Number.isInteger(byteLength) || byteLength < 0) {
    throw new Error(`bigIntToBytes: invalid byteLength ${byteLength}`)
  }

  const bytes = new Uint8Array(byteLength)
  let remaining = value
  for (let i = byteLength - 1; i >= 0; i -= 1) {
    bytes[i] = Number(remaining & 0xffn)
    remaining >>= 8n
  }
  if (remaining !== 0n) {
    throw new Error(`bigIntToBytes: value does not fit in ${byteLength} bytes`)
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
 * @throws If `value` is negative or does not fit in `byteLength` bytes.
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
 * input unchanged when it is already at least `targetLength` bytes.
 * @param bytes - Byte array to pad.
 * @param targetLength - Desired minimum length in bytes.
 * @returns Byte array of at least `targetLength` bytes.
 */
const padBytesLeft = (bytes: Uint8Array, targetLength: number): Uint8Array => {
  if (bytes.length >= targetLength) {
    return bytes
  }
  const padded = new Uint8Array(targetLength)
  padded.set(bytes, targetLength - bytes.length)
  return padded
}

/**
 * Coerces heterogeneous inputs into a normalized lowercase hex string
 * without a `0x` prefix. Strings have any `0x` prefix stripped and are
 * validated as hex; bigints and numbers are encoded as big-endian with
 * leading-zero padding to an even length; byte arrays are hex-encoded.
 * @param data - Value to coerce: hex string, non-negative bigint/number, or byte array.
 * @returns Lowercase hex string without a `0x` prefix.
 * @throws If `data` is a string containing non-hex characters, or a negative bigint/number.
 */
const hexlify = (data: string | bigint | number | Uint8Array): string => {
  if (typeof data === 'string') {
    const stripped = stripHexPrefix(data).toLowerCase()
    if (stripped.length > 0 && !HEX_CHARACTERS.test(stripped)) {
      throw new Error('hexlify: input string contains non-hex characters')
    }
    return stripped
  }

  if (typeof data === 'bigint' || typeof data === 'number') {
    const asBigInt = BigInt(data)
    if (asBigInt < 0n) {
      throw new Error('hexlify: negative values are not supported')
    }
    let hex = asBigInt.toString(16)
    if (hex.length % 2 === 1) {
      hex = `0${hex}`
    }
    return hex
  }

  return bytesToHex(data)
}

export {
  bigIntToBytes,
  bigIntToHex,
  bytesToBigInt,
  bytesToHex,
  hexToBytes,
  hexlify,
  padBytesLeft,
  stripHexPrefix,
}
