import { Bot } from 'grammy';
import { env } from './config/env';
import { whitelistMiddleware } from './middleware/whitelist.middleware';
import { sessionMiddleware } from './middleware/session.middleware';
import { startHandler, helpHandler, statusHandler, docsHandler, prontoHandler, cancelarHandler } from './handlers/command.handler';
import { messageHandler } from './handlers/message.handler';
import { documentHandler } from './handlers/document.handler';

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

// Middlewares (order matters!)
bot.use(whitelistMiddleware(env.ALLOWED_TELEGRAM_IDS));
bot.use(sessionMiddleware());

// Commands
bot.command('start', startHandler);
bot.command('help', helpHandler);
bot.command('status', statusHandler);
bot.command('docs', docsHandler);
bot.command('pronto', prontoHandler);
bot.command('cancelar', cancelarHandler);

// Messages
bot.on('message:text', messageHandler);

// Documents
bot.on('message:document', documentHandler);

// Start bot
if (env.NODE_ENV !== 'production') {
  bot.start();
  console.log('Bot running in polling mode...');
}

export default bot;
