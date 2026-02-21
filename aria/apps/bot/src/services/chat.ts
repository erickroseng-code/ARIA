import Anthropic from '@anthropic-ai/sdk';
import { ChatService, contextStore } from '@aria/core';
import { env } from '../config/env';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

export const chatService = new ChatService(anthropic, contextStore);
