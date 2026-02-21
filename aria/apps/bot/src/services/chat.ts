import Anthropic from '@anthropic-ai/sdk';
import { ChatService, ContextStore } from '@aria/core';
import { env } from '../config/env';

const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

const contextStore = new ContextStore();

export const chatService = new ChatService(anthropic, contextStore);
