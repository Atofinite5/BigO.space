import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../shared/errors';

/**
 * Guards routes to ADMIN-only access.
 * Must be placed after `requireAuth` in the middleware chain.
 */
export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.user?.role !== 'ADMIN') {
    next(new ForbiddenError('Admin access required.'));
    return;
  }
  next();
}
