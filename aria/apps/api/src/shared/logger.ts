import pino from 'pino';
import { env } from '../config/env';

const isProduction = env.NODE_ENV === 'production';

const options: pino.LoggerOptions = {
  level: env.LOG_LEVEL,
};

if (!isProduction) {
  options.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      singleLine: false,
      translateTime: 'SYS:standard',
    },
  };
}

export const logger = pino(options);
