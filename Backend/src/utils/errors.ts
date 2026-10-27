// ==============================================================================
// GUTech Internal LMS - Custom Application Errors & Helpers
// ==============================================================================

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown[];

  constructor(statusCode: number, code: string, message: string, details?: unknown[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const badRequest = (message: string, details?: unknown[]) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message: string = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message: string = 'Access denied for your role') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message: string = 'Resource not found') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string) =>
  new AppError(409, 'CONFLICT', message);

export const unprocessable = (message: string, details?: unknown[]) =>
  new AppError(422, 'VALIDATION_ERROR', message, details);

export const tooManyRequests = (message: string = 'Too many requests, please slow down') =>
  new AppError(429, 'RATE_LIMIT_EXCEEDED', message);
