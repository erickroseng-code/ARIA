/**
 * OpenRouter Adapter - Compatible with Anthropic SDK interface
 * Allows ChatService to use OpenRouter without major refactoring
 */

import { OpenRouterService, FREE_MODELS, FALLBACK_MODELS_LIST, type OpenRouterMessage } from './OpenRouterService';

const MAX_WAIT_TIME_MS = 15000;

export class OpenRouterAdapter {
  private openRouter: OpenRouterService;
  private model: string;

  constructor(apiKey?: string, model: string = FREE_MODELS.LLAMA_3_3_70B) {
    this.openRouter = new OpenRouterService(apiKey);
    this.model = model;
  }

  /**
   * Anthropic-compatible interface for streaming responses
   */
  async *streamResponse(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) {
    const openRouterMessages: OpenRouterMessage[] = messages
      .map(m => ({
        role: m.role as any, // OpenRouter handles 'system' correctly
        content: m.content,
      }));

    let fullResponse = '';

    // Fallback loop taking priority of current model first, then the list
    const modelsToTry = [this.model, ...FALLBACK_MODELS_LIST.filter(m => m !== this.model)];

    for (const modelAttempt of modelsToTry) {
      console.log(`[OpenRouterAdapter] Attempting stream inference with model: ${modelAttempt}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), MAX_WAIT_TIME_MS);

      try {
        fullResponse = await this.openRouter.call(openRouterMessages, {
          model: modelAttempt,
          temperature: 0.7,
          max_tokens: 4096,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // If we get a valid response, break out of fallback loop
        if (fullResponse) {
          console.log(`[OpenRouterAdapter] Success with model: ${modelAttempt}`);
          break;
        }
      } catch (error) {
        clearTimeout(timeoutId);
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        console.warn(`[OpenRouterAdapter] Model ${modelAttempt} failed. ${isTimeout ? 'TIMEOUT' : error}. Trying next...`);
        // Continue to the next model in the loop
      }
    }

    if (!fullResponse) {
      console.error('[OpenRouterAdapter] All fallback models failed or timed out.');
      fullResponse = 'Desculpe, os servidores de IA gratuitos estão todos sobrecarregados no momento. Por favor, tente novamente em alguns instantes.';
    }

    // Yield character by character to simulate streaming
    for (const char of fullResponse) {
      yield {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: char },
      };
    }

    yield {
      type: 'message_stop',
    };
  }

  /**
   * Anthropic-compatible interface for complete responses
   */
  async completeResponse(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>): Promise<string> {
    const openRouterMessages: OpenRouterMessage[] = messages
      .map(m => ({
        role: m.role as any, // OpenRouter handles 'system' correctly
        content: m.content,
      }));

    const modelsToTry = [this.model, ...FALLBACK_MODELS_LIST.filter(m => m !== this.model)];

    for (const modelAttempt of modelsToTry) {
      console.log(`[OpenRouterAdapter] Attempting complete inference with model: ${modelAttempt}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), MAX_WAIT_TIME_MS);

      try {
        const response = await this.openRouter.call(openRouterMessages, {
          model: modelAttempt,
          temperature: 0.7,
          max_tokens: 4096,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        const isTimeout = error instanceof Error && error.name === 'AbortError';
        console.warn(`[OpenRouterAdapter] Model ${modelAttempt} failed in completeResponse. ${isTimeout ? 'TIMEOUT' : error}. Trying next...`);
      }
    }

    throw new Error('All OpenRouter fallback models failed or timed out.');
  }

  setModel(model: string): void {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }
}

/**
 * Create a wrapper that mimics Anthropic SDK messages API
 */
export class OpenRouterMessagesAPI {
  constructor(private adapter: OpenRouterAdapter) { }

  async *stream(params: {
    model: string;
    max_tokens: number;
    system: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  }) {
    const { system, messages } = params;
    this.adapter.setModel(params.model);

    const allMessages = [
      { role: 'system' as const, content: system },
      ...messages,
    ];

    for await (const chunk of this.adapter.streamResponse(allMessages)) {
      yield chunk;
    }
  }

  async create(params: {
    model: string;
    max_tokens: number;
    system: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  }): Promise<{ content: Array<{ type: string; text: string }> }> {
    const { system, messages } = params;
    this.adapter.setModel(params.model);

    const allMessages = [
      { role: 'system' as const, content: system },
      ...messages,
    ];

    const response = await this.adapter.completeResponse(allMessages);
    return {
      content: [{ type: 'text', text: response }],
    };
  }
}

/**
 * Create a mock Anthropic client that uses OpenRouter
 */
export function createOpenRouterClient(apiKey?: string): any {
  const adapter = new OpenRouterAdapter(apiKey);
  const messagesAPI = new OpenRouterMessagesAPI(adapter);

  return {
    messages: messagesAPI,
  };
}
