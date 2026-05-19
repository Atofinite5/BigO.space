import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { sendSuccess } from '../../shared/response';

export const authController = {
  /**
   * GET /api/auth/me
   * Returns the authenticated user's profile.
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getProfile(req.user.id);
      sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/auth/me
   * Syncs optional profile fields (name, avatarUrl).
   */
  async updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, avatarUrl } = req.body as {
        name?: string;
        avatarUrl?: string;
      };
      const user = await authService.syncProfile(req.user.id, { name, avatarUrl });
      sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  },
};
