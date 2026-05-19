import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sessionService } from './session.service';
import { sendSuccess } from '../../shared/response';
import { ValidationError } from '../../shared/errors';

const startSessionSchema = z.object({
  type: z.enum(['CALL', 'INTERVIEW']).default('CALL'),
  deviceId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const sessionController = {
  /**
   * POST /api/sessions/start
   */
  async startSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = startSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid session start payload', parsed.error.errors);
      }
      const session = await sessionService.startSession({
        userId: req.user.id,
        type: parsed.data.type,
        deviceId: parsed.data.deviceId,
        clientIp: req.ip,
        userAgent: req.get('user-agent'),
        metadata: parsed.data.metadata,
      });
      sendSuccess(res, session, 201);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/sessions/:sessionId/heartbeat
   */
  async heartbeat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await sessionService.heartbeat(
        req.params.sessionId,
        req.user.id,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/sessions/:sessionId/end
   */
  async endSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await sessionService.endSession(
        req.params.sessionId,
        req.user.id,
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/sessions/:sessionId/pause
   */
  async pauseSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await sessionService.pauseSession(
        req.params.sessionId,
        req.user.id,
      );
      sendSuccess(res, session);
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/sessions/:sessionId/resume
   */
  async resumeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await sessionService.resumeSession(
        req.params.sessionId,
        req.user.id,
      );
      sendSuccess(res, session);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/sessions/:sessionId
   */
  async getSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await sessionService.getSession(
        req.params.sessionId,
        req.user.id,
      );
      sendSuccess(res, session);
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/sessions
   */
  async listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const skip = parseInt((req.query.skip as string) ?? '0', 10);
      const take = parseInt((req.query.take as string) ?? '20', 10);
      const sessions = await sessionService.listSessions(req.user.id, { skip, take });
      sendSuccess(res, sessions);
    } catch (err) {
      next(err);
    }
  },
};
