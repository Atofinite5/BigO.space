import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { groqProvider } from '../ai-provider/providers/groq.provider';
import { redisClient } from '../../config/redis';
import { logger } from '../../shared/logger';

// ─── Per-user rate limits (free tier) ────────────────────────────────────────
// Groq free tier: ~30 req/min, ~14,400 req/day (generous).
// We're more conservative to avoid key exhaustion across all users.
const FREE_RPM = 20;          // max requests per minute per licenseKey/IP
const FREE_RPD = 200;         // max requests per day per licenseKey/IP

// ─── Request schemas ──────────────────────────────────────────────────────────

const SolveSchema = z.object({
  licenseKey: z.string().optional(),
  deviceId: z.string().min(1),
  systemPrompt: z.string().min(1).max(8000),
  userPrompt: z.string().min(1).max(16000),
  /** Base64-encoded PNG/JPEG screenshots — optional, triggers vision model */
  screenshots: z.array(z.string().max(3_000_000)).max(4).optional(),
  mimeType: z.enum(['image/png', 'image/jpeg']).default('image/png'),
});

const TranscribeSchema = z.object({
  licenseKey: z.string().optional(),
  deviceId: z.string().min(1),
  /** Base64-encoded audio file (webm/wav/mp3) */
  audioBase64: z.string().max(10_000_000),
  filename: z.string().default('audio.webm'),
  language: z.string().length(2).default('en'),
});

// ─── Rate-limit helper ────────────────────────────────────────────────────────

async function checkRateLimit(key: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const minuteKey = `rl:ai:min:${key}:${Math.floor(Date.now() / 60_000)}`;
    const dayKey    = `rl:ai:day:${key}:${new Date().toISOString().slice(0, 10)}`;

    const [minuteCount, dayCount] = await Promise.all([
      redisClient.incr(minuteKey),
      redisClient.incr(dayKey),
    ]);

    // Set TTL on first increment
    if (minuteCount === 1) await redisClient.expire(minuteKey, 60);
    if (dayCount === 1)    await redisClient.expire(dayKey, 86_400);

    if (minuteCount > FREE_RPM) {
      return { allowed: false, retryAfter: 60 };
    }
    if (dayCount > FREE_RPD) {
      return { allowed: false, retryAfter: 86_400 };
    }
    return { allowed: true };
  } catch (e) {
    // Redis down → fail open (don't block users)
    logger.warn({ err: e }, '[ai-proxy] Redis rate-limit check failed — failing open');
    return { allowed: true };
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /api/ai/solve
 * Accept screenshots + prompts, call Groq (vision or text), return content.
 * Auth: licenseKey + deviceId (same pattern as /api/licenses/validate).
 */
export async function solveHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = SolveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }

    const { deviceId, systemPrompt, userPrompt, screenshots, mimeType } = parsed.data;

    // Rate-limit by deviceId (works without auth too)
    const rlKey = parsed.data.licenseKey ?? deviceId;
    const { allowed, retryAfter } = await checkRateLimit(rlKey);
    if (!allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter,
        message: `Free tier limit reached. Try again in ${retryAfter}s.`,
      });
      return;
    }

    let result: string;

    if (screenshots && screenshots.length > 0) {
      // Vision path — screenshots present
      const completion = await groqProvider.completeWithVision(
        systemPrompt,
        userPrompt,
        screenshots,
        mimeType,
      );
      result = completion.content;
      logger.info({
        model: completion.model,
        tokens: completion.totalTokens,
        deviceId,
      }, '[ai-proxy] vision solve');
    } else {
      // Text-only path
      const completion = await groqProvider.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: 'llama-3.3-70b-versatile',
        maxTokens: 4096,
        temperature: 0.2,
      });
      result = completion.content;
      logger.info({
        model: completion.model,
        tokens: completion.totalTokens,
        deviceId,
      }, '[ai-proxy] text solve');
    }

    res.json({ content: result });
  } catch (err) {
    logger.error({ err }, '[ai-proxy] solve error');
    next(err);
  }
}

/**
 * POST /api/ai/transcribe
 * Accept base64 audio, transcribe via Groq Whisper, return transcript text.
 */
export async function transcribeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = TranscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }

    const { deviceId, audioBase64, filename, language } = parsed.data;

    const rlKey = parsed.data.licenseKey ?? deviceId;
    const { allowed, retryAfter } = await checkRateLimit(rlKey);
    if (!allowed) {
      res.status(429).json({ error: 'Rate limit exceeded', retryAfter });
      return;
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const transcript = await groqProvider.transcribeAudio(audioBuffer, filename, language);

    logger.info({ deviceId, bytes: audioBuffer.length }, '[ai-proxy] transcribe');
    res.json({ transcript: transcript.trim() });
  } catch (err) {
    logger.error({ err }, '[ai-proxy] transcribe error');
    next(err);
  }
}
