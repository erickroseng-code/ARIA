import type { FastifyInstance } from 'fastify';
import { sendTelegram } from '../shared/telegram';
import { getAuditLogs } from '../modules/traffic/agents/atlas-audit';
import { isAtlasWriteEnabled } from '../modules/traffic/agents/atlas-orchestrator';
import { isWorkspaceConfigured } from '@aria/integrations';

function isAuthorized(chatId: number): boolean {
  const allowed = (process.env.ALLOWED_TELEGRAM_IDS ?? '')
    .split(',').map(id => id.trim()).filter(Boolean);
  return allowed.includes(String(chatId));
}

export async function registerTelegramWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/webhook', async (req, reply) => {
    // Always respond 200 immediately — Telegram resends if no response within 5s
    reply.status(200).send({ ok: true });

    const body = req.body as any;
    const message = body?.message;
    if (!message?.text || !message?.chat?.id) return;

    const chatId: number = message.chat.id;
    if (!isAuthorized(chatId)) return;

    const command = message.text.trim().split(' ')[0].toLowerCase();

    // Process asynchronously — reply already sent
    setImmediate(async () => {
      switch (command) {
        case '/status':
          await handleStatus(chatId);
          break;
        case '/atlas':
          await handleAtlas(chatId);
          break;
        case '/help':
          await handleHelp(chatId);
          break;
        default:
          await sendTelegram(chatId, 'Comando não reconhecido. Use /help para ver os comandos disponíveis.');
      }
    });
  });
}

async function handleStatus(chatId: number): Promise<void> {
  const googleOk = await isWorkspaceConfigured().catch(() => false);
  const atlasMode = isAtlasWriteEnabled() ? '⚡ ativo' : '🔒 modo seguro';
  const uptimeSec = Math.floor(process.uptime());
  const h = Math.floor(uptimeSec / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);

  await sendTelegram(
    chatId,
    `🤖 <b>Aria — Status</b>\n` +
    `✅ API: online\n` +
    `${googleOk ? '✅' : '❌'} Google: ${googleOk ? 'conectado' : 'desconectado'}\n` +
    `📊 Atlas: ${atlasMode}\n` +
    `🔔 Telegram: ativo\n` +
    `⏰ Uptime: ${h}h ${m}m`
  );
}

async function handleAtlas(chatId: number): Promise<void> {
  const logs = getAuditLogs(undefined, 5);

  if (logs.length === 0) {
    await sendTelegram(chatId, '📊 <b>Atlas</b>\nNenhuma ação registrada ainda.');
    return;
  }

  const lines = ['📊 <b>Atlas — Últimas ações</b>'];
  for (const log of logs) {
    const icon = log.result.startsWith('ERROR') ? '❌' : '✅';
    const dryRunFlag = (log as any).dry_run === 1 ? ' <i>[dry-run]</i>' : '';
    lines.push(`${icon} ${log.action} (${log.entityId})${dryRunFlag}: ${log.result}`);
  }

  await sendTelegram(chatId, lines.join('\n'));
}

async function handleHelp(chatId: number): Promise<void> {
  await sendTelegram(
    chatId,
    `🤖 <b>Aria — Comandos</b>\n\n` +
    `/status — Status geral da Aria\n` +
    `/atlas — Últimas ações autônomas do Atlas\n` +
    `/help — Esta mensagem`
  );
}
