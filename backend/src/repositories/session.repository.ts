import { AiSession, Prisma, SessionStatus } from '@prisma/client';
import { prisma } from '../config/database';

export const sessionRepository = {
  create(data: Prisma.AiSessionCreateInput): Promise<AiSession> {
    return prisma.aiSession.create({ data });
  },

  findById(id: string): Promise<AiSession | null> {
    return prisma.aiSession.findUnique({ where: { id } });
  },

  update(id: string, data: Prisma.AiSessionUpdateInput): Promise<AiSession> {
    return prisma.aiSession.update({ where: { id }, data });
  },

  /**
   * Find any currently ACTIVE session for this user.
   * Used to enforce concurrency limits.
   */
  findActiveByUserId(userId: string): Promise<AiSession | null> {
    return prisma.aiSession.findFirst({
      where: { userId, status: 'ACTIVE' },
    });
  },

  /**
   * Count active sessions for concurrency check.
   */
  countActiveByUserId(userId: string): Promise<number> {
    return prisma.aiSession.count({
      where: { userId, status: 'ACTIVE' },
    });
  },

  /**
   * Mark sessions as EXPIRED if no heartbeat within threshold.
   * Called by a background job.
   */
  expireStaleSessions(staleThresholdDate: Date): Promise<Prisma.BatchPayload> {
    return prisma.aiSession.updateMany({
      where: {
        status: 'ACTIVE',
        lastHeartbeatAt: { lt: staleThresholdDate },
      },
      data: { status: 'EXPIRED', endedAt: new Date() },
    });
  },

  findManyByUserId(
    userId: string,
    args: { skip?: number; take?: number; status?: SessionStatus } = {},
  ): Promise<AiSession[]> {
    return prisma.aiSession.findMany({
      where: { userId, ...(args.status ? { status: args.status } : {}) },
      skip: args.skip ?? 0,
      take: args.take ?? 20,
      orderBy: { startedAt: 'desc' },
    });
  },

  /**
   * Create an append-only usage transaction record.
   */
  createUsageTransaction(data: {
    subscriptionId: string;
    sessionId: string;
    secondsDeducted: number;
    balanceBefore: number;
    balanceAfter: number;
    reason: string;
  }): Promise<void> {
    return prisma.usageTransaction
      .create({ data })
      .then(() => undefined);
  },
};
