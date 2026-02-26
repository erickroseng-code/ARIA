import Anthropic from '@anthropic-ai/sdk';
import { ChatService, contextStore } from '@aria/core';
import { env } from '../config/env';

// Use OpenRouter API (compatible with Anthropic SDK)
const anthropic = new Anthropic({
  apiKey: env.OPENROUTER_API_KEY || env.ANTHROPIC_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/erick-synkra/aios-core',
    'X-Title': 'ARIA Bot',
  },
});

export const chatService = new ChatService(anthropic, contextStore);
