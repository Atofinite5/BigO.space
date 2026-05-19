import { User } from '@prisma/client';
import { userRepository } from '../../repositories/user.repository';
import { NotFoundError } from '../../shared/errors';

export const authService = {
  /**
   * Called after requireAuth middleware — user is already upserted.
   * Returns the current user profile with their active subscription summary.
   */
  async getProfile(userId: string): Promise<User> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError('User');
    return user;
  },

  /**
   * Sync profile data from Clerk (called when user updates their Clerk profile).
   */
  async syncProfile(
    userId: string,
    data: { name?: string; avatarUrl?: string },
  ): Promise<User> {
    const user = await userRepository.update(userId, data);
    return user;
  },
};
