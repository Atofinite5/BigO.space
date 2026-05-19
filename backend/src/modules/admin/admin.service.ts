import { prisma } from '../../config/database';
import { subscriptionRepository } from '../../repositories/subscription.repository';
import { userRepository } from '../../repositories/user.repository';
import { paymentRepository } from '../../repositories/payment.repository';
import { sessionRepository } from '../../repositories/session.repository';
import { NotFoundError } from '../../shared/errors';
import { logger } from '../../shared/logger';
import { invalidatePlanLimitCache } from '../../middleware/rateLimiter.middleware';

export const adminService = {
  // ─── Users ──────────────────────────────────────────────────────────────────

  async listUsers(skip = 0, take = 20) {
    const [users, total] = await Promise.all([
      userRepository.findMany({ skip, take }),
      userRepository.count(),
    ]);
    return { users, total, skip, take };
  },

  async getUserDetail(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');

    const [subscriptions, sessions, payments] = await Promise.all([
      subscriptionRepository.findManyByUserId(userId),
      sessionRepository.findManyByUserId(userId, { take: 20 }),
      paymentRepository.findManyByUserId(userId, { take: 20 }),
    ]);

    return { user, subscriptions, sessions, payments };
  },

  async suspendUser(userId: string, actorId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');

    await userRepository.update(userId, { status: 'SUSPENDED' });

    // Suspend their active subscriptions too
    await prisma.userSubscription.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'SUSPENDED' },
    });

    await paymentRepository.createAuditLog({
      actorId,
      targetId: userId,
      targetType: 'User',
      action: 'SUSPEND_USER',
    });

    logger.warn({ userId, actorId }, 'User suspended by admin');
  },

  async unsuspendUser(userId: string, actorId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');

    await userRepository.update(userId, { status: 'ACTIVE' });

    await paymentRepository.createAuditLog({
      actorId,
      targetId: userId,
      targetType: 'User',
      action: 'UNSUSPEND_USER',
    });

    logger.info({ userId, actorId }, 'User unsuspended by admin');
  },

  // ─── Time Grants ────────────────────────────────────────────────────────────

  /**
   * Manually grant or deduct AI seconds from a user's active subscription.
   * Positive seconds = grant, negative = deduct.
   */
  async adjustTime(userId: string, seconds: number, actorId: string) {
    const sub = await subscriptionRepository.findActiveByUserId(userId);
    if (!sub) throw new NotFoundError('Active subscription for this user');

    const balanceBefore = sub.remainingSeconds;

    if (seconds > 0) {
      await subscriptionRepository.atomicGrantSeconds(sub.id, seconds);
    } else {
      // Deduct (clamp to 0)
      await prisma.$executeRaw`
        UPDATE "UserSubscription"
        SET "remainingSeconds" = GREATEST("remainingSeconds" + ${seconds}, 0),
            "updatedAt"        = NOW()
        WHERE id = ${sub.id}
      `;
    }

    // Append to usage ledger for audit
    const updated = await subscriptionRepository.findById(sub.id);
    await prisma.usageTransaction.create({
      data: {
        subscriptionId: sub.id,
        // Admin adjustments don't have a real session — we create a dummy reference
        // In production, consider a nullable sessionId on UsageTransaction
        sessionId: sub.id, // using sub.id as placeholder — adjust schema if needed
        secondsDeducted: -seconds, // Negative means grant in the ledger convention
        balanceBefore,
        balanceAfter: updated?.remainingSeconds ?? 0,
        reason: seconds > 0 ? 'admin_grant' : 'admin_deduct',
      },
    });

    await paymentRepository.createAuditLog({
      actorId,
      targetId: sub.id,
      targetType: 'UserSubscription',
      action: seconds > 0 ? 'GRANT_TIME' : 'DEDUCT_TIME',
      metadata: { seconds, balanceBefore, balanceAfter: updated?.remainingSeconds },
    });

    await invalidatePlanLimitCache(userId);

    logger.info({ userId, seconds, actorId }, 'Admin time adjustment');
    return updated;
  },

  // ─── Payments ───────────────────────────────────────────────────────────────

  listPayments(skip = 0, take = 50) {
    return paymentRepository.findMany({ skip, take });
  },

  // ─── Sessions ───────────────────────────────────────────────────────────────

  listSessions(skip = 0, take = 50) {
    return prisma.aiSession.findMany({
      skip,
      take,
      orderBy: { startedAt: 'desc' },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  },

  // ─── Audit Logs ─────────────────────────────────────────────────────────────

  listAuditLogs(skip = 0, take = 50) {
    return prisma.auditLog.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  },
};
