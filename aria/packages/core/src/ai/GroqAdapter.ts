/**
 * Groq Adapter - Compatible with Anthropic SDK interface
 * Allows ChatService to use Groq API without major refactoring
 */

import { GroqService, GROQ_MODELS, type GroqMessage } from './GroqService';

const MAX_WAIT_TIME_MS = 60000; // 60s max request threshold

export class GroqAdapter {
    private groq: GroqService;
    private model: string;

    constructor(apiKey?: string, model: string = GROQ_MODELS.LLAMA_3_3_70B) {
        this.groq = new GroqService(apiKey);
        this.model = model;
    }

    /**
     * Anthropic-compatible interface for streaming responses
     */
    async *streamResponse(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) {
        const groqMessages: GroqMessage[] = messages
            .map(m => ({
                role: m.role as any, // OpenAI/Groq handles 'system' correctly
                content: m.content,
            }));

        console.log(`[GroqAdapter] Attempting stream inference with model: ${this.model}`);
        const controller = new AbortController();
        let timeoutId = setTimeout(() => controller.abort(), 30000); // 30s TTFT timeout

        try {
            const stream = this.groq.streamCall(groqMessages, {
                model: this.model,
                temperature: 0.7,
                max_tokens: 4096,
                signal: controller.signal,
            });

            let firstChunk = true;
            for await (const chunk of stream) {
                if (firstChunk) {
                    clearTimeout(timeoutId); // We got a response, clear TTFT timeout
                    firstChunk = false;
                }

                yield {
                    type: 'content_block_delta',
                    delta: { type: 'text_delta', text: chunk },
                };
            }

        } catch (error) {
            clearTimeout(timeoutId);
            const errorMsg = error instanceof Error ? error.message : String(error);
            const isTimeout = error instanceof Error && error.name === 'AbortError';
            console.warn(`[GroqAdapter] Model ${this.model} failed. ${isTimeout ? 'TIMEOUT' : error}. Returning error message.`);
            yield {
                type: 'content_block_delta',
                delta: { type: 'text_delta', text: `[ERRO GROQ API]: ${errorMsg}` },
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
        const groqMessages: GroqMessage[] = messages
            .map(m => ({
                role: m.role as any,
                content: m.content,
            }));

        console.log(`[GroqAdapter] Attempting complete inference with model: ${this.model}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), MAX_WAIT_TIME_MS);

        try {
            const response = await this.groq.call(groqMessages, {
                model: this.model,
                temperature: 0.7,
                max_tokens: 4096,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
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
export class GroqMessagesAPI {
    constructor(private adapter: GroqAdapter) { }

    async *stream(params: {
        model: string;
        max_tokens: number;
        system: string;
        messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    }) {
        const { system, messages } = params;
        // Map non-Groq models to Groq equivalent if hardcoded
        if (params.model.includes('llama')) this.adapter.setModel(GROQ_MODELS.LLAMA_3_3_70B);
        else this.adapter.setModel(params.model);

        const allMessages = [
            { role: 'system' as const, content: system },
            ...messages,
        ].filter(m => m.content && m.content.trim().length > 0);

        for await (const chunk of this.adapter.streamResponse(allMessages)) {
            yield chunk;
        }
    }

    async create(params: any): Promise<{ content: Array<{ type: string; text: string }> }> {
        const { system, messages, model } = params;
        // Map non-Groq models to Groq equivalent
        if (model?.includes('llama')) this.adapter.setModel(GROQ_MODELS.LLAMA_3_3_70B);
        else if (model) this.adapter.setModel(model);

        const allMessages = [
            { role: 'system' as const, content: system },
            ...messages,
        ].filter(m => m.content && m.content.trim().length > 0);

        const response = await this.adapter.completeResponse(allMessages);
        return {
            content: [{ type: 'text', text: response }],
        };
    }
}

/**
 * Create a mock Anthropic client that uses Groq
 */
export function createGroqClient(apiKey?: string): any {
    const adapter = new GroqAdapter(apiKey);
    const messagesAPI = new GroqMessagesAPI(adapter);

    return {
        messages: messagesAPI,
    };
}
