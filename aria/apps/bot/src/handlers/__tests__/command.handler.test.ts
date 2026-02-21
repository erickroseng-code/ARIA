import { describe, it, expect, vi } from 'vitest';
import { startHandler, helpHandler } from '../command.handler';
import { WELCOME_MESSAGE, HELP_MESSAGE } from '../../templates/responses';

describe('command handlers', () => {
  it('should send welcome message on /start', async () => {
    const ctx = {
      reply: vi.fn(),
    } as any;

    await startHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(WELCOME_MESSAGE, { parse_mode: 'MarkdownV2' });
  });

  it('should send help message on /help', async () => {
    const ctx = {
      reply: vi.fn(),
    } as any;

    await helpHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(HELP_MESSAGE, { parse_mode: 'MarkdownV2' });
  });
});
