import * as path from 'path';
import { config } from 'dotenv';

// Load from aria/.env (canonical environment file for this monorepo app)
// Path from: aria/apps/api/src/config/env.ts → aria/.env
config({ path: path.resolve(__dirname, '../../../../.env') }); // aria/apps/api/dist/config → aria/.env
config({ path: path.resolve(process.cwd(), '../../.env') });   // fallback: aria/apps/api → aria/.env
config({ path: path.resolve(process.cwd(), '.env') });          // fallback: local .env

import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3001').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // LLM providers
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required'),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),

  // Google Workspace OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional().default('http://localhost:3001/api/auth/google/callback'),

  // Notion configuration
  NOTION_API_KEY: z.string().optional(),
  NOTION_DATABASE_ID: z.string().optional(),
  NOTION_TASKS_DATABASE_ID: z.string().optional(),

  // ClickUp configuration (supports both naming conventions)
  CLICKUP_API_KEY: z.string().optional(),
  CLICKUP_API_TOKEN: z.string().optional(),
  CLICKUP_TEAM_ID: z.string().optional(),
  CLICKUP_LIST_ID: z.string().optional(),
  CLICKUP_DEFAULT_LIST_ID: z.string().optional(),
  CLICKUP_ID_LIST: z.string().optional(),
  CLICKUP_USER_ID: z.string().optional(),

  // CORS allowlist (comma-separated origins)
  ALLOWED_ORIGINS: z.string().optional().default('http://localhost:3000,http://localhost:3001'),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
