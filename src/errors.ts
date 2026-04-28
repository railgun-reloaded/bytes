/**
 * Thrown by `hexToBytes` (and any caller using it without `allowOddLength`)
 * when the hex string has an odd number of characters and cannot be split
 * into whole bytes.
 */
class OddLengthHexError extends Error {
  /**
   * Construct an OddLengthHexError.
   * @param message - Error message describing the offending input length.
   */
  constructor (message?: string) {
    super(message)
    this.name = 'OddLengthHexError'
  }
}

/**
 * Thrown when a hex string contains characters outside `[0-9a-fA-F]`.
 */
class InvalidHexError extends Error {
  /**
   * Construct an InvalidHexError.
   * @param message - Error message describing the malformed input.
   */
  constructor (message?: string) {
    super(message)
    this.name = 'InvalidHexError'
  }
}

/**
 * Thrown by `bigIntToBytes` when a value's binary representation does not
 * fit in the requested fixed `byteLength`.
 */
class BigIntOverflowError extends Error {
  /**
   * Construct a BigIntOverflowError.
   * @param message - Error message describing the value and byteLength.
   */
  constructor (message?: string) {
    super(message)
    this.name = 'BigIntOverflowError'
  }
}

/**
 * Thrown when a negative value is passed to a helper that only accepts
 * non-negative inputs (e.g. `bigIntToBytes`).
 */
class NegativeValueError extends Error {
  /**
   * Construct a NegativeValueError.
   * @param message - Error message identifying the negative input.
   */
  constructor (message?: string) {
    super(message)
    this.name = 'NegativeValueError'
  }
}

/**
 * Thrown when a `byteLength` argument is not a non-negative integer.
 */
class InvalidByteLengthError extends Error {
  /**
   * Construct an InvalidByteLengthError.
   * @param message - Error message describing the offending byteLength.
   */
  constructor (message?: string) {
    super(message)
    this.name = 'InvalidByteLengthError'
  }
}

/**
 * Thrown by `chunk` when the requested chunk size is not a positive integer.
 */
class InvalidChunkSizeError extends Error {
  /**
   * Construct an InvalidChunkSizeError.
   * @param message - Error message describing the offending size.
   */
  constructor (message?: string) {
    super(message)
    this.name = 'InvalidChunkSizeError'
  }
}

export {
  BigIntOverflowError,
  InvalidByteLengthError,
  InvalidChunkSizeError,
  InvalidHexError,
  NegativeValueError,
  OddLengthHexError,
}
