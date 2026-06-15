import { Router } from 'express';
import { solveHandler, transcribeHandler } from './ai-proxy.controller';

const router = Router();

/**
 * POST /api/ai/solve
 * Vision or text solve via Groq (server-side key — free for users).
 */
router.post('/solve', solveHandler);

/**
 * POST /api/ai/transcribe
 * Audio transcription via Groq Whisper (server-side key — free for users).
 */
router.post('/transcribe', transcribeHandler);

export default router;
