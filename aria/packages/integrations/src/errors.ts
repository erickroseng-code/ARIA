/**
 * Common error class for integration errors
 */

export interface IntegrationErrorOptions {
  statusCode?: number;
  cause?: unknown;
}

export class IntegrationError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public override readonly name = 'IntegrationError';
  public override readonly cause?: unknown;

  constructor(message: string, code: string, options: IntegrationErrorOptions = {}) {
    super(message);
    this.code = code;
    this.statusCode = options.statusCode || 500;
    this.cause = options.cause;

    // Set prototype for instanceof checks
    Object.setPrototypeOf(this, IntegrationError.prototype);
  }
}
