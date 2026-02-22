import { z } from 'zod';

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  ALLOWED_TELEGRAM_IDS: z.string().transform((s) => {
    if (s === '*') return [0]; // Allow all
    return s.split(',').map((id) => Number(id.trim()));
  }),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_URL: z.string().default('http://localhost:3001'),
  OPENAI_API_KEY: z.string().optional().default(''),

  // ClickUp Configuration
  CLICKUP_API_KEY: z.string().optional(),
  CLICKUP_DEFAULT_LIST_ID: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
