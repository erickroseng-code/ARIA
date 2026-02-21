import { Middleware } from 'grammy';

export interface SessionData {
  sessionId: string;
}

export function sessionMiddleware(): Middleware<any> {
  return async (ctx: any, next) => {
    const chatId = ctx.chat?.id;

    if (!chatId) {
      return next();
    }

    // Create session ID based on chat ID
    ctx.session ??= {
      sessionId: `tg_${chatId}`,
    };

    return next();
  };
}
