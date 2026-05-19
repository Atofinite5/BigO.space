import {
  AiCompletionOptions,
  AiCompletionResult,
  AiProvider,
} from '../ai.provider.interface';
import { env } from '../../../config/env';
import { logger } from '../../../shared/logger';

/**
 * Google Gemini provider stub.
 * Uses the Gemini generateContent REST API.
 */
export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  readonly defaultModel = 'gemini-1.5-pro';

  private readonly apiKey: string;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor() {
    if (!env.GEMINI_API_KEY) {
      logger.warn('GEMINI_API_KEY not set — Gemini provider will fail at runtime');
    }
    this.apiKey = env.GEMINI_API_KEY ?? '';
  }

  async complete(options: AiCompletionOptions): Promise<AiCompletionResult> {
    const model = options.model ?? this.defaultModel;
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    // Map OpenAI-style messages to Gemini format
    const contents = options.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = options.messages.find((m) => m.role === 'system');

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.7,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction.content }],
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${error}`);
    }

    const data = (await response.json()) as {
      candidates: Array<{
        content: { parts: Array<{ text: string }> };
        finishReason: string;
      }>;
      usageMetadata: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
      };
    };

    const content =
      data.candidates[0]?.content?.parts?.map((p) => p.text).join('') ?? '';

    return {
      content,
      model,
      promptTokens: data.usageMetadata.promptTokenCount,
      completionTokens: data.usageMetadata.candidatesTokenCount,
      totalTokens: data.usageMetadata.totalTokenCount,
      finishReason: data.candidates[0]?.finishReason ?? 'STOP',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/models?key=${this.apiKey}`;
      const res = await fetch(url);
      return res.ok;
    } catch {
      return false;
    }
  }
}
