import { InvalidChunkSizeError } from './errors'

/**
 * Splits a byte array into fixed-size chunks. The final chunk may be shorter
 * than `size` if `data.length` is not an even multiple of `size`. Empty input
 * returns an empty array.
 * @param data - Byte array to split.
 * @param size - Chunk size in bytes; must be a positive integer.
 * @returns Array of chunk byte arrays in order.
 * @throws {InvalidChunkSizeError} If `size` is not a positive integer.
 */
const chunk = (data: Uint8Array, size: number): Uint8Array[] => {
  if (!Number.isInteger(size) || size <= 0) {
    throw new InvalidChunkSizeError(`chunk: invalid size ${size}`)
  }
  const chunks: Uint8Array[] = []
  for (let i = 0; i < data.length; i += size) {
    chunks.push(data.slice(i, i + size))
  }
  return chunks
}

/**
 * Concatenates a list of byte arrays end-to-end into a single byte array.
 * @param chunks - Byte arrays to concatenate, in order.
 * @returns A single byte array containing every input back-to-back. An empty
 * input list returns an empty `Uint8Array`.
 */
const combine = (chunks: Uint8Array[]): Uint8Array => {
  let totalLength = 0
  for (const c of chunks) {
    totalLength += c.length
  }
  const out = new Uint8Array(totalLength)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

export {
  chunk,
  combine,
}
