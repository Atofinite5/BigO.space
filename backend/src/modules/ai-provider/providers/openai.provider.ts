import {
  AiCompletionOptions,
  AiCompletionResult,
  AiProvider,
} from '../ai.provider.interface';
import { env } from '../../../config/env';
import { logger } from '../../../shared/logger';

/**
 * OpenAI provider stub.
 * Calls the OpenAI Chat Completions API.
 * Replace the fetch call with the official `openai` npm package in production.
 */
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  readonly defaultModel = 'gpt-4o';

  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openai.com/v1';

  constructor() {
    if (!env.OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY not set — OpenAI provider will fail at runtime');
    }
    this.apiKey = env.OPENAI_API_KEY ?? '';
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
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${error}`);
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
