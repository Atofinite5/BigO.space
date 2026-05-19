import { AiSession, SessionStatus, SessionType } from '@prisma/client';
import { prisma } from '../../config/database';
import { redisClient } from '../../config/redis';
import { env } from '../../config/env';
import { sessionRepository } from '../../repositories/session.repository';
import { subscriptionRepository } from '../../repositories/subscription.repository';
import {
  QuotaExhaustedError,
  CallLimitExhaustedError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
  SubscriptionRequiredError,
} from '../../shared/errors';
import { logger } from '../../shared/logger';

// ─── Redis key helpers ────────────────────────────────────────────────────────
const sessionLockKey = (userId: string) => `lock:session_start:${userId}`;
const LOCK_TTL_MS = 8000; // 8 second lock for session start

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StartSessionInput {
  userId: string;
  type: SessionType;
  deviceId?: string;
  clientIp?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface HeartbeatResult {
  sessionId: string;
  status: SessionStatus;
  remainingSeconds: number;
  totalConsumedSeconds: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const sessionService = {
  /**
   * START SESSION
   * ─────────────────────────────────────────────────────────────────────────
   * 1. Validate active subscription + quota
   * 2. Enforce concurrency limit (plan.maxConcurrentSessions)
   * 3. Acquire Redis lock to prevent race conditions from multiple tabs
   * 4. Create AiSession record
   * 5. Decrement remainingCalls atomically
   */
  async startSession(input: StartSessionInput): Promise<AiSession> {
    const { userId } = input;

    // ── Step 1: Check subscription ──────────────────────────────────────────
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub) throw new SubscriptionRequiredError();
    if (sub.remainingSeconds <= 0) throw new QuotaExhaustedError();
    if (sub.remainingCalls <= 0) throw new CallLimitExhaustedError();

    // ── Step 2: Concurrency check ───────────────────────────────────────────
    const activeSessions = await sessionRepository.countActiveByUserId(userId);
    if (activeSessions >= sub.plan.maxConcurrentSessions) {
      throw new ConflictError(
        `You already have ${activeSessions} active session(s). ` +
          `Your plan allows ${sub.plan.maxConcurrentSessions} concurrent session(s).`,
      );
    }

    // ── Step 3: Acquire Redis lock ──────────────────────────────────────────
    const lockKey = sessionLockKey(userId);
    const acquired = await redisClient.set(lockKey, '1', 'EX', Math.ceil(LOCK_TTL_MS / 1000), 'NX');
    if (!acquired) {
      throw new ConflictError(
        'Another session is starting. Please wait a moment and try again.',
      );
    }

    try {
      // ── Step 4 & 5: Create session + decrement call count in a transaction ─
      const session = await prisma.$transaction(async (tx) => {
        // Atomically decrement remainingCalls (prevents going below 0)
        const decremented = await tx.$executeRaw`
          UPDATE "UserSubscription"
          SET "remainingCalls" = "remainingCalls" - 1,
              "updatedAt"      = NOW()
          WHERE id = ${sub.id}
            AND "remainingCalls" > 0
            AND status = 'ACTIVE'
        `;

        if (decremented === 0) throw new CallLimitExhaustedError();

        return tx.aiSession.create({
          data: {
            userId,
            subscriptionId: sub.id,
            type: input.type,
            status: 'ACTIVE',
            startedAt: new Date(),
            lastHeartbeatAt: new Date(),
            clientIp: input.clientIp,
            userAgent: input.userAgent,
            deviceId: input.deviceId,
            metadata: input.metadata as object ?? null,
          },
        });
      });

      logger.info(
        { sessionId: session.id, userId, type: input.type },
        'AI session started',
      );
      return session;
    } finally {
      await redisClient.del(lockKey);
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  /**
   * HEARTBEAT
   * ─────────────────────────────────────────────────────────────────────────
   * Called every N seconds while AI is active.
   * Computes elapsed time since last heartbeat and atomically deducts quota.
   * If quota drops to 0, the session is immediately expired.
   */
  async heartbeat(
    sessionId: string,
    userId: string,
  ): Promise<HeartbeatResult> {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new NotFoundError('Session');
    if (session.userId !== userId) throw new ForbiddenError();

    if (session.status === 'PAUSED') {
      // During pause we don't bill — just update heartbeat timestamp
      await sessionRepository.update(sessionId, { lastHeartbeatAt: new Date() });
      const sub = await subscriptionRepository.findActiveByUserId(userId);
      return {
        sessionId,
        status: 'PAUSED',
        remainingSeconds: sub?.remainingSeconds ?? 0,
        totalConsumedSeconds: session.totalConsumedSeconds,
      };
    }

    if (session.status !== 'ACTIVE') {
      throw new ConflictError(`Session is ${session.status} and cannot accept heartbeats.`);
    }

    // ── Compute elapsed seconds ─────────────────────────────────────────────
    const now = new Date();
    const lastHb = session.lastHeartbeatAt ?? session.startedAt;
    const elapsedSeconds = Math.floor((now.getTime() - lastHb.getTime()) / 1000);

    // Guard: skip if heartbeat is too frequent (< 5 seconds) — prevents double deduction
    if (elapsedSeconds < 5) {
      const sub = await subscriptionRepository.findActiveByUserId(userId);
      return {
        sessionId,
        status: 'ACTIVE',
        remainingSeconds: sub?.remainingSeconds ?? 0,
        totalConsumedSeconds: session.totalConsumedSeconds,
      };
    }

    // ── Atomic deduction + session update in one transaction ────────────────
    return await prisma.$transaction(async (tx) => {
      // Fetch current balance
      const subRecord = await tx.userSubscription.findUnique({
        where: { id: session.subscriptionId },
        select: { remainingSeconds: true, status: true },
      });

      if (!subRecord || subRecord.status !== 'ACTIVE') {
        throw new SubscriptionRequiredError('Subscription is no longer active.');
      }

      const balanceBefore = subRecord.remainingSeconds;
      const actualDeduction = Math.min(elapsedSeconds, balanceBefore);
      const balanceAfter = balanceBefore - actualDeduction;
      const quotaExhausted = balanceBefore <= elapsedSeconds;

      // Atomic deduct — uses raw SQL so it's one round-trip with no race condition
      await tx.$executeRaw`
        UPDATE "UserSubscription"
        SET "remainingSeconds" = GREATEST("remainingSeconds" - ${elapsedSeconds}, 0),
            "updatedAt"        = NOW()
        WHERE id = ${session.subscriptionId}
      `;

      // Update session
      const newStatus: SessionStatus = quotaExhausted ? 'EXPIRED' : 'ACTIVE';
      const newConsumed = session.totalConsumedSeconds + actualDeduction;

      await tx.aiSession.update({
        where: { id: sessionId },
        data: {
          lastHeartbeatAt: now,
          totalConsumedSeconds: newConsumed,
          status: newStatus,
          ...(quotaExhausted ? { endedAt: now } : {}),
        },
      });

      // Append-only ledger entry
      await tx.usageTransaction.create({
        data: {
          subscriptionId: session.subscriptionId,
          sessionId,
          secondsDeducted: actualDeduction,
          balanceBefore,
          balanceAfter,
          reason: 'heartbeat',
        },
      });

      if (quotaExhausted) {
        logger.warn({ sessionId, userId }, 'Session quota exhausted — session expired');
        throw new QuotaExhaustedError();
      }

      return {
        sessionId,
        status: newStatus,
        remainingSeconds: balanceAfter,
        totalConsumedSeconds: newConsumed,
      };
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  /**
   * END SESSION
   * Final deduction based on time since last heartbeat, then mark ENDED.
   */
  async endSession(
    sessionId: string,
    userId: string,
  ): Promise<{ totalConsumedSeconds: number; remainingSeconds: number }> {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new NotFoundError('Session');
    if (session.userId !== userId) throw new ForbiddenError();
    if (session.status === 'ENDED' || session.status === 'EXPIRED') {
      // Idempotent — return last known state
      const sub = await subscriptionRepository.findActiveByUserId(userId);
      return {
        totalConsumedSeconds: session.totalConsumedSeconds,
        remainingSeconds: sub?.remainingSeconds ?? 0,
      };
    }

    const now = new Date();
    const lastHb = session.lastHeartbeatAt ?? session.startedAt;
    const elapsedSeconds = session.status === 'PAUSED'
      ? 0 // Don't bill paused time
      : Math.floor((now.getTime() - lastHb.getTime()) / 1000);

    return await prisma.$transaction(async (tx) => {
      const subRecord = await tx.userSubscription.findUnique({
        where: { id: session.subscriptionId },
        select: { remainingSeconds: true },
      });

      const balanceBefore = subRecord?.remainingSeconds ?? 0;
      const actualDeduction = Math.min(elapsedSeconds, balanceBefore);
      const balanceAfter = Math.max(balanceBefore - actualDeduction, 0);
      const newConsumed = session.totalConsumedSeconds + actualDeduction;

      await tx.$executeRaw`
        UPDATE "UserSubscription"
        SET "remainingSeconds" = GREATEST("remainingSeconds" - ${actualDeduction}, 0),
            "updatedAt"        = NOW()
        WHERE id = ${session.subscriptionId}
      `;

      await tx.aiSession.update({
        where: { id: sessionId },
        data: {
          status: 'ENDED',
          endedAt: now,
          totalConsumedSeconds: newConsumed,
          lastHeartbeatAt: now,
        },
      });

      if (actualDeduction > 0) {
        await tx.usageTransaction.create({
          data: {
            subscriptionId: session.subscriptionId,
            sessionId,
            secondsDeducted: actualDeduction,
            balanceBefore,
            balanceAfter,
            reason: 'session_end',
          },
        });
      }

      logger.info(
        { sessionId, userId, consumed: newConsumed, remaining: balanceAfter },
        'AI session ended',
      );

      return { totalConsumedSeconds: newConsumed, remainingSeconds: balanceAfter };
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  /**
   * PAUSE SESSION
   * Records pausedAt — heartbeats during pause still touch lastHeartbeatAt
   * but do NOT deduct time.
   */
  async pauseSession(sessionId: string, userId: string): Promise<AiSession> {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new NotFoundError('Session');
    if (session.userId !== userId) throw new ForbiddenError();
    if (session.status !== 'ACTIVE') {
      throw new ConflictError(`Cannot pause a session with status ${session.status}.`);
    }

    return sessionRepository.update(sessionId, {
      status: 'PAUSED',
      pausedAt: new Date(),
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  /**
   * RESUME SESSION
   * Clears pausedAt and resets lastHeartbeatAt to now so the paused
   * duration is never billed.
   */
  async resumeSession(sessionId: string, userId: string): Promise<AiSession> {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new NotFoundError('Session');
    if (session.userId !== userId) throw new ForbiddenError();
    if (session.status !== 'PAUSED') {
      throw new ConflictError(`Cannot resume a session with status ${session.status}.`);
    }

    // Calculate paused duration and add to pausedDurationSeconds (for analytics)
    const pausedSecs = session.pausedAt
      ? Math.floor((Date.now() - session.pausedAt.getTime()) / 1000)
      : 0;

    return sessionRepository.update(sessionId, {
      status: 'ACTIVE',
      pausedAt: null,
      lastHeartbeatAt: new Date(), // Reset so paused gap isn't billed on next heartbeat
      pausedDurationSeconds: session.pausedDurationSeconds + pausedSecs,
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  /**
   * GET SESSION
   */
  async getSession(sessionId: string, userId: string): Promise<AiSession> {
    const session = await sessionRepository.findById(sessionId);
    if (!session) throw new NotFoundError('Session');
    if (session.userId !== userId) throw new ForbiddenError();
    return session;
  },

  /**
   * LIST USER SESSIONS
   */
  listSessions(
    userId: string,
    args: { skip?: number; take?: number; status?: SessionStatus } = {},
  ): Promise<AiSession[]> {
    return sessionRepository.findManyByUserId(userId, args);
  },

  // ─────────────────────────────────────────────────────────────────────────
  /**
   * EXPIRE STALE SESSIONS (background job)
   * Called periodically to clean up sessions that lost connectivity.
   */
  async expireStale(): Promise<number> {
    const thresholdMs =
      env.SESSION_STALE_THRESHOLD_SECONDS * 1000;
    const staleDate = new Date(Date.now() - thresholdMs);
    const result = await sessionRepository.expireStaleSessions(staleDate);

    if (result.count > 0) {
      logger.info({ count: result.count }, 'Stale sessions expired');
    }
    return result.count;
  },
};
