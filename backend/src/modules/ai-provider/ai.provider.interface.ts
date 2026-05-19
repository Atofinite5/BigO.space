/**
 * Provider-agnostic contract for all AI providers.
 * The session service depends only on this interface —
 * swap OpenAI for Gemini or any future provider without touching business logic.
 */

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCompletionOptions {
  messages: AiMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface AiCompletionResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  finishReason: string;
}

export interface AiProvider {
  readonly name: string;
  readonly defaultModel: string;

  /**
   * Generate a completion. Implementations must handle retries internally.
   */
  complete(options: AiCompletionOptions): Promise<AiCompletionResult>;

  /**
   * Health check — returns true if the provider is reachable.
   */
  healthCheck(): Promise<boolean>;
}
