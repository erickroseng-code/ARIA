export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly options?: {
      statusCode?: number;
      cause?: unknown;
      context?: Record<string, unknown>;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(process.env.NODE_ENV === 'development' && {
        context: this.options?.context,
      }),
    };
  }
}
