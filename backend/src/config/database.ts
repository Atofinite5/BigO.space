import { PrismaClient } from '@prisma/client';
import { env } from './env';

declare global {
  // Prevent multiple Prisma client instances in development (Next.js / ts-node hot reload)
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = (): PrismaClient =>
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  });

export const prisma: PrismaClient =
  global.__prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
