import { ActionResult } from './atlas-orchestrator';
import { sendTelegram } from '../../../shared/telegram';

export async function sendAtlasNotification(
  actionsExecuted: ActionResult[],
  dryRun: boolean
): Promise<void> {
  if (dryRun) return; // Silencioso em dry-run

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.warn('[Atlas Notify] TELEGRAM_CHAT_ID não configurado');
    return;
  }

  if (actionsExecuted.length === 0) return;

  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const errors = actionsExecuted.filter(a => a.result.startsWith('ERROR')).length;

  const lines: string[] = [
    `🤖 <b>Atlas — Ciclo de Otimização</b>`,
    `📅 ${now}`,
    '',
  ];

  for (const a of actionsExecuted) {
    const icon = a.result.startsWith('ERROR') ? '❌' : '✅';
    lines.push(`${icon} ${a.action} (${a.entityId}): ${a.result}`);
  }

  lines.push('');
  lines.push(`Total: ${actionsExecuted.length} ação(ões) | ${errors} erro(s)`);
  lines.push(`Modo: PRODUÇÃO`);

  await sendTelegram(chatId, lines.join('\n'));
}

export async function sendAtlasErrorAlert(errorMessage: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  await sendTelegram(chatId, `⚠️ <b>Atlas — Erro no Ciclo</b>\nFalha ao carregar dados: ${errorMessage}`);
}
