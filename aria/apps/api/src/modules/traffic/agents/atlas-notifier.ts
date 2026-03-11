import { ActionResult } from './atlas-orchestrator';
import { sendTelegram } from '../../../shared/telegram';

const ACTION_LABELS: Record<string, string> = {
  pause_campaign:        '⏸ Campanha pausada',
  enable_campaign:       '▶️ Campanha ativada',
  update_budget:         '💰 Budget atualizado',
  pause_adset:           '⏸ Adset pausado',
  enable_adset:          '▶️ Adset ativado',
  update_adset_budget:   '💰 Budget do adset atualizado',
  pause_ad:              '⏸ Anúncio pausado',
  enable_ad:             '▶️ Anúncio ativado',
  create_campaign_complete: '🆕 Campanha criada',
  update_ad_creative:    '🎨 Criativo atualizado',
};

export async function sendAtlasNotification(
  actionsExecuted: ActionResult[],
  dryRun: boolean
): Promise<void> {
  if (dryRun) return;

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    console.warn('[Atlas Notify] TELEGRAM_CHAT_ID não configurado');
    return;
  }

  if (actionsExecuted.length === 0) return;

  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const errors = actionsExecuted.filter(a => a.result.startsWith('ERROR')).length;
  const successes = actionsExecuted.length - errors;

  const lines: string[] = [
    `🤖 <b>Atlas — Resumo Diário</b>`,
    `📅 ${now}`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `✅ ${successes} ação(ões) executada(s)${errors > 0 ? ` · ❌ ${errors} erro(s)` : ''}`,
    `━━━━━━━━━━━━━━━━━━`,
  ];

  for (const a of actionsExecuted) {
    const isError = a.result.startsWith('ERROR');
    const label = ACTION_LABELS[a.action] ?? `⚙️ ${a.action}`;
    const name = a.entityName ? `"${a.entityName}"` : `ID: ${a.entityId}`;

    lines.push(``);
    if (isError) {
      lines.push(`❌ <b>${label}:</b> ${name}`);
      lines.push(`   └ ${a.result.replace(/^ERROR:\s*/, '')}`);
    } else {
      lines.push(`${label}: <b>${name}</b>`);
      if (a.reason) lines.push(`   └ ${a.reason}`);
    }
  }

  lines.push(``, `━━━━━━━━━━━━━━━━━━`);
  lines.push(`Modo: PRODUÇÃO`);

  await sendTelegram(chatId, lines.join('\n'));
}

export async function sendAtlasErrorAlert(errorMessage: string): Promise<void> {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  await sendTelegram(chatId, `⚠️ <b>Atlas — Erro no Ciclo</b>\nFalha ao carregar dados: ${errorMessage}`);
}
