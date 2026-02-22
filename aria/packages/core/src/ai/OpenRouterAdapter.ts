/**
 * OpenRouter Adapter - Compatible with Anthropic SDK interface
 * Allows ChatService to use OpenRouter without major refactoring
 */

import { OpenRouterService, FREE_MODELS, type OpenRouterMessage } from './OpenRouterService';

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
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Get full response first (OpenRouter doesn't support true streaming yet)
    const fullResponse = await this.openRouter.call(openRouterMessages, {
      model: this.model,
      temperature: 0.7,
      max_tokens: 4096,
    });

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
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    return this.openRouter.call(openRouterMessages, {
      model: this.model,
      temperature: 0.7,
      max_tokens: 4096,
    });
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
  constructor(private adapter: OpenRouterAdapter) {}

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
