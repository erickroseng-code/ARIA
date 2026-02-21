import pino from 'pino';
import { env } from '../config/env';

const isProduction = env.NODE_ENV === 'production';

const transportConfig = isProduction
  ? undefined
  : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: false,
        translateTime: 'SYS:standard' as const,
      },
    };

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(transportConfig && { transport: transportConfig }),
} as any);
