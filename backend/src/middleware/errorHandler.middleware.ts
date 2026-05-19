import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors';
import { sendError } from '../shared/response';
import { logger } from '../shared/logger';
import { env } from '../config/env';

/**
 * Global error handler — must be registered as the LAST middleware.
 * Maps all thrown errors to consistent ApiResponse JSON.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // 1. Operational AppError (our own typed errors)
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(
        { err, path: req.path, method: req.method },
        'Unhandled server error',
      );
    }
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // 2. Zod validation errors (should normally be caught by validateBody, but just in case)
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 400, 'VALIDATION_ERROR', 'Request validation failed', details);
    return;
  }

  // 3. Prisma known errors
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: string }).code === 'string'
  ) {
    const prismaErr = err as { code: string; message: string };
    if (prismaErr.code === 'P2002') {
      sendError(res, 409, 'CONFLICT', 'A record with that value already exists');
      return;
    }
    if (prismaErr.code === 'P2025') {
      sendError(res, 404, 'NOT_FOUND', 'Record not found');
      return;
    }
  }

  // 4. Unknown / programming errors
  logger.error({ err, path: req.path, method: req.method }, 'Unexpected error');

  sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again.'
      : (err instanceof Error ? err.message : String(err)),
  );
}
