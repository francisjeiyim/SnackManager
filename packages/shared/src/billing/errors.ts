/** Raised when a billing operation is asked to do something inconsistent. */
export class BillingError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "BillingError";
  }
}
