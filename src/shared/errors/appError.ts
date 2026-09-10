export abstract class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number, code: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Restore prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation Failed', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication Failed', details?: unknown) {
    super(message, 401, 'UNAUTHENTICATED', details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Permission Denied', details?: unknown) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource Not Found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict / Duplicate Entry', details?: unknown) {
    super(message, 409, 'DUPLICATE_ENTRY', details);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message = 'Business Rule Violation', details?: unknown) {
    super(message, 422, 'BUSINESS_RULE_VIOLATION', details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too Many Requests', details?: unknown) {
    super(message, 429, 'TOO_MANY_REQUESTS', details);
  }
}

export class RateLimitError extends TooManyRequestsError {}
