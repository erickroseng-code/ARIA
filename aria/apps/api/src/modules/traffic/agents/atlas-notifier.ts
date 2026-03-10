import { ActionResult } from './atlas-orchestrator';

export async function sendAtlasNotification(
  actionsExecuted: ActionResult[],
  dryRun: boolean
): Promise<void> {
  if (dryRun) return; // Silencioso em dry-run

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.warn('[Atlas Notify] TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID não configurados');
    return;
  }

  if (actionsExecuted.length === 0) return;

  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const lines: string[] = [
    `🤖 *Atlas — Ciclo de Otimização*`,
    `📅 ${now}`,
    '',
  ];

  for (const a of actionsExecuted) {
    const icon = a.result.startsWith('ERROR') ? '❌' : '✅';
    lines.push(`${icon} ${a.action} (${a.entityId}): ${a.result}`);
  }

  const errors = actionsExecuted.filter(a => a.result.startsWith('ERROR')).length;
  lines.push('');
  lines.push(`Total: ${actionsExecuted.length} ações | ${errors} erro(s)`);
  lines.push(`Modo: PRODUÇÃO \\(dry\\_run=false\\)`);

  const text = lines.join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
    });
  } catch (err) {
    console.error('[Atlas Notify] Falha ao enviar mensagem Telegram:', err);
  }
}

export async function sendAtlasErrorAlert(errorMessage: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  // Escape special chars for MarkdownV2
  const safeMsg = errorMessage.replace(/[_*[\]()~`>#+\-=|{}.!]/g, c => `\\${c}`);

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⚠️ *Atlas — Erro no Ciclo*\nFalha ao carregar dados: ${safeMsg}`,
        parse_mode: 'MarkdownV2',
      }),
    });
  } catch { /* ignorar — não propagar erro de notificação */ }
}
