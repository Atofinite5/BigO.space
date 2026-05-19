import { Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../config/redis';
import { subscriptionRepository } from '../repositories/subscription.repository';
import { logger } from '../shared/logger';

// ─────────────────────────────────────────────
// Layer 1 — Global IP-based limiter (all routes)
// ─────────────────────────────────────────────
export const globalIpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sendCommand: ((...args: string[]) =>
      redisClient.call(args[0], ...args.slice(1))) as any,
    prefix: 'rl:ip:',
  }),
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests from this IP.' },
  },
});

// ─────────────────────────────────────────────
// Layer 2 — Plan-aware per-user limiter factory
// ─────────────────────────────────────────────

const PLAN_CACHE_TTL = 60; // seconds

/**
 * Creates an Express middleware that enforces per-user, plan-based rate limits.
 * Limits are cached in Redis for 60s to avoid DB hits on every request.
 */
export function planAwareRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next();
      return;
    }

    try {
      const userId = req.user.id;
      const cacheKey = `plan_limits:${userId}`;

      let limitPerMinute: number;
      let limitPerHour: number;

      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          perMinute: number;
          perHour: number;
        };
        limitPerMinute = parsed.perMinute;
        limitPerHour = parsed.perHour;
      } else {
        const sub = await subscriptionRepository.findActiveByUserId(userId);
        limitPerMinute = sub?.plan.rateLimitPerMinute ?? 10; // Free tier default
        limitPerHour = sub?.plan.rateLimitPerHour ?? 50;

        await redisClient.setex(
          cacheKey,
          PLAN_CACHE_TTL,
          JSON.stringify({ perMinute: limitPerMinute, perHour: limitPerHour }),
        );
      }

      // Check per-minute window
      const minuteKey = `rl:user:${userId}:min`;
      const minuteCount = await redisClient.incr(minuteKey);
      if (minuteCount === 1) await redisClient.expire(minuteKey, 60);

      if (minuteCount > limitPerMinute) {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Per-minute limit of ${limitPerMinute} requests exceeded.`,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Check per-hour window
      const hourKey = `rl:user:${userId}:hour`;
      const hourCount = await redisClient.incr(hourKey);
      if (hourCount === 1) await redisClient.expire(hourKey, 3600);

      if (hourCount > limitPerHour) {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Per-hour limit of ${limitPerHour} requests exceeded.`,
          },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      next();
    } catch (err) {
      logger.warn({ err }, 'Rate limiter error — allowing request through');
      next(); // Fail open so a Redis blip doesn't lock out users
    }
  };
}

/**
 * Invalidates cached plan limits for a user (call after plan upgrade/downgrade).
 */
export async function invalidatePlanLimitCache(userId: string): Promise<void> {
  await redisClient.del(`plan_limits:${userId}`);
}
