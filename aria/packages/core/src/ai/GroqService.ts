import fetch from 'node-fetch';

export interface GroqOptions {
    model: string;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    signal?: AbortSignal;
}

export interface GroqMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export const GROQ_MODELS = {
    LLAMA_3_3_70B: 'llama-3.3-70b-versatile',
    LLAMA_3_1_8B: 'llama-3.1-8b-instant',
    MIXTRAL_8X7B: 'mixtral-8x7b-32768',
} as const;

export class GroqService {
    private apiKey: string;
    private baseUrl = 'https://api.groq.com/openai/v1';

    constructor(apiKey?: string) {
        this.apiKey = apiKey || process.env.GROQ_API_KEY || '';
        if (!this.apiKey) {
            throw new Error('GROQ_API_KEY not set in environment or constructor');
        }
    }

    async call(
        messages: GroqMessage[],
        options: GroqOptions
    ): Promise<string> {
        const {
            model,
            temperature = 0.7,
            max_tokens = 2000,
            top_p = 0.9,
            signal,
        } = options;

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                signal,
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature,
                    max_tokens,
                    top_p,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(
                    `Groq API error: ${response.status} ${JSON.stringify(error)}`
                );
            }

            const data = (await response.json()) as any;
            return data.choices[0]?.message?.content || '';
        } catch (error) {
            throw new Error(
                `Groq call failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async *streamCall(
        messages: GroqMessage[],
        options: GroqOptions
    ): AsyncGenerator<string> {
        const {
            model,
            temperature = 0.7,
            max_tokens = 2000,
            top_p = 0.9,
            signal,
        } = options;

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature,
                    max_tokens,
                    top_p,
                    stream: true,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Groq API error: ${response.status} ${JSON.stringify(error)}`);
            }

            const body = response.body;
            if (!body) throw new Error('No response body from Groq');

            // Robust streaming parser to handle chunks split across network packets
            let buffer = '';
            for await (const chunk of body) {
                buffer += chunk.toString();
                const lines = buffer.split('\n');

                // Keep the last incomplete line in the buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.length === 0) continue;
                    if (trimmedLine === 'data: [DONE]') return;

                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(trimmedLine.substring(6));
                            const content = data.choices[0]?.delta?.content;
                            if (content) yield content;
                        } catch (e) {
                            // JSON parse error usually means incomplete chunk despite line breaks
                            // In a perfect SSE world this shouldn't happen within a single data line,
                            // but we catch it just in case.
                            console.error('[GroqService] Stream parse error on line:', trimmedLine);
                        }
                    }
                }
            }
        } catch (error) {
            throw new Error(`Groq stream failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
