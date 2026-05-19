import { Payment, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export const paymentRepository = {
  create(data: Prisma.PaymentCreateInput): Promise<Payment> {
    return prisma.payment.create({ data });
  },

  findById(id: string): Promise<Payment | null> {
    return prisma.payment.findUnique({ where: { id } });
  },

  findByProviderPaymentId(providerPaymentId: string): Promise<Payment | null> {
    return prisma.payment.findUnique({ where: { providerPaymentId } });
  },

  findByIdempotencyKey(key: string): Promise<Payment | null> {
    return prisma.payment.findUnique({ where: { idempotencyKey: key } });
  },

  update(id: string, data: Prisma.PaymentUpdateInput): Promise<Payment> {
    return prisma.payment.update({ where: { id }, data });
  },

  findManyByUserId(
    userId: string,
    args: { skip?: number; take?: number; status?: PaymentStatus } = {},
  ): Promise<Payment[]> {
    return prisma.payment.findMany({
      where: { userId, ...(args.status ? { status: args.status } : {}) },
      skip: args.skip ?? 0,
      take: args.take ?? 20,
      orderBy: { createdAt: 'desc' },
    });
  },

  findMany(
    args: {
      skip?: number;
      take?: number;
      where?: Prisma.PaymentWhereInput;
    } = {},
  ): Promise<Payment[]> {
    return prisma.payment.findMany({
      skip: args.skip ?? 0,
      take: args.take ?? 50,
      where: args.where,
      orderBy: { createdAt: 'desc' },
    });
  },

  count(where?: Prisma.PaymentWhereInput): Promise<number> {
    return prisma.payment.count({ where });
  },

  createAuditLog(data: {
    actorId?: string;
    targetId?: string;
    targetType?: string;
    action: string;
    metadata?: object;
    ipAddress?: string;
  }): Promise<void> {
    return prisma.auditLog
      .create({ data })
      .then(() => undefined);
  },
};
