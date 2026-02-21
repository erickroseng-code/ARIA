import { z } from 'zod';

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  ALLOWED_TELEGRAM_IDS: z.string().transform((s) => s.split(',').map((id) => Number(id.trim()))),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_URL: z.string().default('http://localhost:3001'),
  ANTHROPIC_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required for audio transcription'),

  // ClickUp Configuration
  CLICKUP_API_KEY: z.string().optional(),
  CLICKUP_DEFAULT_LIST_ID: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
