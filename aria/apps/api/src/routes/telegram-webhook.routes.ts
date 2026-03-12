import type { FastifyInstance } from 'fastify';
import { TrafficService } from '../modules/traffic/traffic.service';
import { handleTelegramUpdate, isAuthorized } from '../modules/telegram/telegram-bot.service';

const trafficService = new TrafficService();

export async function registerTelegramWebhookRoutes(fastify: FastifyInstance): Promise<void> {

  // POST /api/telegram/webhook — receives all Telegram updates
  fastify.post('/webhook', async (req, reply) => {
    // Always respond 200 immediately — Telegram resends if no response within 5s
    reply.status(200).send({ ok: true });

    const update = req.body as any;

    // Auth check for messages
    const chatId = update?.message?.chat?.id ?? update?.callback_query?.from?.id;
    if (chatId && !isAuthorized(chatId)) return;

    setImmediate(async () => {
      try {
        await handleTelegramUpdate(update, trafficService);
      } catch (err) {
        console.error('[Telegram Webhook] Unhandled error:', err);
      }
    });
  });

  // POST /api/telegram/setup-webhook — register webhook URL with Telegram
  fastify.post('/setup-webhook', async (req, reply) => {
    const body = req.body as any;
    const url: string = body?.url;
    if (!url) return reply.status(400).send({ error: 'url is required' });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return reply.status(500).send({ error: 'TELEGRAM_BOT_TOKEN not set' });

    const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, allowed_updates: ['message', 'callback_query'] }),
    });
    const data = await res.json() as any;
    return reply.send(data);
  });

  // GET /api/telegram/webhook-info — check registered webhook
  fastify.get('/webhook-info', async (_req, reply) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return reply.status(500).send({ error: 'TELEGRAM_BOT_TOKEN not set' });

    const res  = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const data = await res.json() as any;
    return reply.send(data);
  });
}
