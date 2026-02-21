export interface AppErrorOptions {
  statusCode?: number;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public override readonly name = 'AppError';
  public override readonly cause?: unknown;

  constructor(message: string, code: string, options: AppErrorOptions = {}) {
    super(message);
    this.code = code;
    this.statusCode = options.statusCode || 500;
    this.cause = options.cause;

    // Set prototype for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
