import { Prisma, User, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../config/database';

export interface CreateUserDto {
  clerkId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export interface UpdateUserDto {
  name?: string;
  avatarUrl?: string;
  status?: UserStatus;
  role?: UserRole;
}

export const userRepository = {
  /**
   * Find a user by their Clerk ID.
   */
  findByClerkId(clerkId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { clerkId } });
  },

  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  /**
   * Upsert a user record — idempotent on first login.
   */
  upsertByClerkId(data: CreateUserDto): Promise<User> {
    return prisma.user.upsert({
      where: { clerkId: data.clerkId },
      create: {
        clerkId: data.clerkId,
        email: data.email,
        name: data.name,
        avatarUrl: data.avatarUrl,
      },
      update: {
        email: data.email,
        name: data.name,
        avatarUrl: data.avatarUrl,
      },
    });
  },

  update(id: string, data: UpdateUserDto): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  },

  /**
   * List users for admin panel with pagination.
   */
  findMany(
    args: { skip?: number; take?: number; where?: Prisma.UserWhereInput } = {},
  ): Promise<User[]> {
    return prisma.user.findMany({
      skip: args.skip ?? 0,
      take: args.take ?? 20,
      where: args.where,
      orderBy: { createdAt: 'desc' },
    });
  },

  count(where?: Prisma.UserWhereInput): Promise<number> {
    return prisma.user.count({ where });
  },
};
