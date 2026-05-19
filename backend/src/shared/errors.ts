/**
 * Typed error hierarchy for the application.
 * All errors extend AppError so the global error handler
 * can produce consistent JSON responses.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    code: string,
    details?: unknown,
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden — insufficient permissions') {
    super(403, message, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, message, 'VALIDATION_ERROR', details);
  }
}

export class QuotaExhaustedError extends AppError {
  constructor(message = 'AI time quota exhausted. Please purchase more time.') {
    super(402, message, 'QUOTA_EXHAUSTED');
  }
}

export class CallLimitExhaustedError extends AppError {
  constructor(message = 'Session call limit reached for your plan.') {
    super(402, message, 'CALL_LIMIT_EXHAUSTED');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

export class PaymentError extends AppError {
  constructor(message: string, details?: unknown) {
    super(402, message, 'PAYMENT_ERROR', details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests — slow down.') {
    super(429, message, 'RATE_LIMIT_EXCEEDED');
  }
}

export class SubscriptionRequiredError extends AppError {
  constructor(message = 'An active subscription is required.') {
    super(403, message, 'SUBSCRIPTION_REQUIRED');
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(500, message, 'INTERNAL_SERVER_ERROR', undefined, false);
  }
}
