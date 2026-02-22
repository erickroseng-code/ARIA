/**
 * OpenRouter Service
 * Abstraction layer for OpenRouter API with free models
 */

import { fetch } from 'node-fetch';

export interface OpenRouterOptions {
  model: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export interface OpenRouterMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const FREE_MODELS = {
  TRINITY_LARGE: 'arcee-ai/trinity-large-preview:free',
  STEP_3_5_FLASH: 'stepfun/step-3.5-flash:free',
  GLM_4_5_AIR: 'z-ai/glm-4.5-air:free',
  DEEPSEEK_R1: 'deepseek/deepseek-r1-0528:free',
  GPT_OSS_120B: 'openai/gpt-oss-120b:free',
  TRINITY_MINI: 'arcee-ai/trinity-mini:free',
  LLAMA_3_3_70B: 'meta-llama/llama-3.3-70b-instruct:free',
  QWEN_CODER: 'qwen/qwen3-coder:free',
  MISTRAL_SMALL: 'mistralai/mistral-small-3.1-24b-instruct:free',
  QWEN_NEXT_80B: 'qwen/qwen3-next-80b-a3b-instruct:free',
} as const;

export class OpenRouterService {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY not set in environment');
    }
  }

  /**
   * Call OpenRouter API with messages
   */
  async call(
    messages: OpenRouterMessage[],
    options: OpenRouterOptions
  ): Promise<string> {
    const {
      model,
      temperature = 0.7,
      max_tokens = 2000,
      top_p = 0.9,
    } = options;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/synkra/aios-core',
          'X-Title': 'ARIA Report Generation',
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
          `OpenRouter API error: ${response.status} ${JSON.stringify(error)}`
        );
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      throw new Error(
        `OpenRouter call failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate report section with a specific model
   */
  async generateSection(
    systemPrompt: string,
    userPrompt: string,
    model: string = FREE_MODELS.TRINITY_LARGE
  ): Promise<string> {
    return this.call(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        model,
        temperature: 0.7,
        max_tokens: 2000,
      }
    );
  }

  /**
   * Parse JSON from response (handles OpenRouter occasional markdown wrapping)
   */
  static parseJSON<T>(response: string): T {
    try {
      // Remove markdown code blocks if present
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      return JSON.parse(cleaned);
    } catch (error) {
      throw new Error(
        `Failed to parse JSON from OpenRouter response: ${response}`
      );
    }
  }
}
