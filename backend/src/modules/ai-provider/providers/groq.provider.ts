import {
  AiCompletionOptions,
  AiCompletionResult,
  AiProvider,
} from '../ai.provider.interface';
import { env } from '../../../config/env';
import { logger } from '../../../shared/logger';

/**
 * Groq provider — OpenAI-compatible API, free tier.
 *
 * Models used:
 *   Vision (screenshots): meta-llama/llama-4-scout-17b-16e-instruct
 *   Text-only fallback:   llama-3.3-70b-versatile
 *
 * Groq's API is wire-compatible with OpenAI's /v1/chat/completions,
 * so the same request shape works for both text and vision.
 */
export class GroqProvider implements AiProvider {
  readonly name = 'groq';
  readonly defaultModel = 'meta-llama/llama-4-scout-17b-16e-instruct';

  /** Text-only model — used when no images are in the request */
  static readonly TEXT_MODEL = 'llama-3.3-70b-versatile';
  /** Vision model — used when images are present */
  static readonly VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
  /** Audio transcription model */
  static readonly AUDIO_MODEL = 'whisper-large-v3';

  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.groq.com/openai/v1';

  constructor() {
    if (!env.GROQ_API_KEY) {
      logger.warn('GROQ_API_KEY not set — Groq provider will fail at runtime');
    }
    this.apiKey = env.GROQ_API_KEY ?? '';
  }

  async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    const model = options.model ?? this.defaultModel;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.2,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: { content: string };
        finish_reason: string;
      }>;
      model: string;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      model: data.model,
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
      finishReason: data.choices[0]?.finish_reason ?? 'stop',
    };
  }

  /**
   * Vision completion — accepts base64-encoded screenshot images alongside
   * the text prompt. Automatically selects the vision model.
   */
  async completeWithVision(
    systemPrompt: string,
    userPrompt: string,
    imageBase64List: string[],
    mimeType: 'image/png' | 'image/jpeg' = 'image/png',
  ): Promise<AiCompletionResult> {
    const imageContent = imageBase64List.map((b64) => ({
      type: 'image_url' as const,
      image_url: { url: `data:${mimeType};base64,${b64}` },
    }));

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      {
        role: 'user' as const,
        content: [
          ...imageContent,
          { type: 'text' as const, text: userPrompt },
        ],
      },
    ];

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GroqProvider.VISION_MODEL,
        messages,
        max_tokens: 4096,
        temperature: 0.2,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq vision API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: { content: string };
        finish_reason: string;
      }>;
      model: string;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

    return {
      content: data.choices[0]?.message?.content ?? '',
      model: data.model,
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
      finishReason: data.choices[0]?.finish_reason ?? 'stop',
    };
  }

  /**
   * Transcribe audio using Groq's Whisper endpoint.
   * audioBuffer should be a Buffer of a valid audio file (webm/wav/mp3).
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    filename = 'audio.webm',
    language = 'en',
  ): Promise<string> {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('file', blob, filename);
    formData.append('model', GroqProvider.AUDIO_MODEL);
    formData.append('language', language);
    formData.append('response_format', 'text');

    const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq audio API error ${response.status}: ${error}`);
    }

    return response.text();
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

// Singleton — import this wherever you need Groq
export const groqProvider = new GroqProvider();
