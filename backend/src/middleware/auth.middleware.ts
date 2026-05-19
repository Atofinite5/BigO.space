import { Request, Response, NextFunction } from 'express';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { User } from '@prisma/client';
import { env } from '../config/env';
import { userRepository } from '../repositories/user.repository';
import { UnauthorizedError } from '../shared/errors';
import { logger } from '../shared/logger';

// Singleton Clerk client (used for user lookups)
const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      auth: {
        clerkId: string;
        sessionId: string;
      };
      user: User;
    }
  }
}

/**
 * Verifies the Clerk Bearer token, upserts the local user record,
 * and attaches both `req.auth` and `req.user` for downstream handlers.
 */
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);

    // Verify against Clerk — throws on invalid/expired token
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });

    const clerkId = payload.sub;
    const sessionId = payload.sid ?? '';

    req.auth = { clerkId, sessionId };

    // Fetch (or upsert) the local user record
    let user = await userRepository.findByClerkId(clerkId);

    if (!user) {
      // Fetch full user details from Clerk on first login
      const clerkUser = await clerk.users.getUser(clerkId);
      const primaryEmail = clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      );

      user = await userRepository.upsertByClerkId({
        clerkId,
        email: primaryEmail?.emailAddress ?? `${clerkId}@noemail.clerk`,
        name: [clerkUser.firstName, clerkUser.lastName]
          .filter(Boolean)
          .join(' ') || undefined,
        avatarUrl: clerkUser.imageUrl || undefined,
      });

      logger.info({ clerkId, userId: user.id }, 'New user created on first login');
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedError('Your account has been suspended. Contact support.');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
    } else {
      next(new UnauthorizedError('Token verification failed'));
    }
  }
}
