/**
 * String-union of every error code this package can throw. Used as the
 * discriminator on `BytesError`. Adding a new failure mode is one entry
 * here plus the corresponding `throw` site — no new class scaffolding.
 */
type BytesErrorCode =
  | 'OddLengthHex'
  | 'InvalidHex'
  | 'BigIntOverflow'
  | 'NegativeValue'
  | 'InvalidByteLength'
  | 'InvalidChunkSize'
  | 'ByteLengthExceeded'

/**
 * The single error class thrown by every helper in this package. Consumers
 * discriminate via `err instanceof BytesError && err.code === '<code>'`.
 *
 * Collapsing this to one class with a code field (rather than one subclass
 * per failure mode) keeps the surface and tests small as new error modes
 * are added.
 */
class BytesError extends Error {
  /**
   * The discriminator identifying which failure mode raised this error.
   */
  readonly code: BytesErrorCode

  /**
   * Construct a BytesError.
   * @param code - One of the `BytesErrorCode` values.
   * @param message - Human-readable error message.
   */
  constructor (code: BytesErrorCode, message?: string) {
    super(message)
    this.name = 'BytesError'
    this.code = code
  }
}

export { BytesError }
export type { BytesErrorCode }
