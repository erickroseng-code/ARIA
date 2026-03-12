import { TrafficService } from '../traffic/traffic.service';
import {
  atlasChat,
  atlasGetProposedActions,
  executeAtlasAction,
  isAtlasWriteEnabled,
  AtlasContext,
  ProposedAction,
} from '../traffic/agents/atlas-orchestrator';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage { role: 'user' | 'assistant'; content: string }

interface Session {
  workspaceId: string;
  accountId: string;
  accountName: string;
  history: ChatMessage[];
  _cache?: { insights: any; campaigns: any[]; cachedAt: number };
}

interface PendingAction {
  action: Record<string, any>;
  ctx: { workspaceId: string; accountId: string; campaigns?: any[]; insights?: any };
  chatId: number;
  expiresAt: number;
}

// ── In-memory state ───────────────────────────────────────────────────────────

const sessions       = new Map<number, Session>();
const pendingActions = new Map<string, PendingAction>();
const pendingSel     = new Map<string, { workspaceId: string; accountId: string; name: string }>();

// ── Telegram API helpers ──────────────────────────────────────────────────────

function botToken(): string { return process.env.TELEGRAM_BOT_TOKEN ?? ''; }

async function apiCall(method: string, body: object): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function send(chatId: number, text: string, replyMarkup?: object): Promise<number> {
  const r = await apiCall('sendMessage', {
    chat_id: chatId, text, parse_mode: 'HTML',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
  return r?.result?.message_id ?? 0;
}

async function editMsg(chatId: number, messageId: number, text: string, replyMarkup?: object): Promise<void> {
  await apiCall('editMessageText', {
    chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

async function answerCb(callbackQueryId: string, text?: string): Promise<void> {
  await apiCall('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

// ── Authorization ─────────────────────────────────────────────────────────────

export function isAuthorized(chatId: number): boolean {
  const ids = [
    ...(process.env.ALLOWED_TELEGRAM_IDS ?? '').split(','),
    process.env.TELEGRAM_CHAT_ID ?? '',
  ].map(s => s.trim()).filter(Boolean);
  return ids.includes(String(chatId));
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function handleTelegramUpdate(update: any, trafficService: TrafficService): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, trafficService);
    return;
  }

  const msg = update.message;
  if (!msg?.text || !msg?.chat?.id) return;

  const chatId: number = msg.chat.id;
  if (!isAuthorized(chatId)) return;

  const text = msg.text.trim();
  const cmd  = text.split(' ')[0].toLowerCase();

  switch (cmd) {
    case '/start':
    case '/ajuda':
    case '/help':   await handleHelp(chatId); break;
    case '/conta':
    case '/contas': await handleSelectAccount(chatId, trafficService); break;
    case '/status': await handleStatus(chatId, trafficService); break;
    case '/otimizar': await handleOtimizar(chatId, trafficService); break;
    case '/relatorio': await handleRelatorio(chatId, trafficService); break;
    default:        await handleAtlasChat(chatId, text, trafficService);
  }
}

// ── Callback handler ──────────────────────────────────────────────────────────

async function handleCallbackQuery(cb: any, trafficService: TrafficService): Promise<void> {
  const chatId: number = cb.from?.id ?? cb.message?.chat?.id;
  const data: string   = cb.data ?? '';
  const messageId: number = cb.message?.message_id ?? 0;

  await answerCb(cb.id);

  if (data.startsWith('sel:')) {
    const sel = pendingSel.get(data.slice(4));
    if (!sel) { await send(chatId, '❌ Seleção expirada. Use /conta novamente.'); return; }
    sessions.set(chatId, { ...sel, workspaceId: sel.workspaceId, accountId: sel.accountId, accountName: sel.name, history: [] });
    pendingSel.delete(data.slice(4));
    await editMsg(chatId, messageId, `✅ <b>Conta selecionada:</b> ${sel.name}\n\nAgora pode me fazer perguntas ou usar /otimizar para ver sugestões.`);
    return;
  }

  if (data.startsWith('ok:')) {
    const pending = pendingActions.get(data.slice(3));
    if (!pending || Date.now() > pending.expiresAt) {
      await editMsg(chatId, messageId, '⏰ Ação expirada (6h). Rode /otimizar novamente.');
      return;
    }
    pendingActions.delete(data.slice(3));
    const ctx: AtlasContext = { workspace: pending.ctx.workspaceId, accountId: pending.ctx.accountId, campaigns: pending.ctx.campaigns, insights: pending.ctx.insights };
    await editMsg(chatId, messageId, '⏳ Executando...');
    const result = await executeAtlasAction(pending.action, ctx, trafficService, !isAtlasWriteEnabled());
    const icon = result.startsWith('ERROR') || result.startsWith('[DRY') || result.startsWith('[MODO') ? (result.startsWith('ERROR') ? '❌' : '🔒') : '✅';
    await editMsg(chatId, messageId, `${icon} ${result}`);
    return;
  }

  if (data.startsWith('no:')) {
    pendingActions.delete(data.slice(3));
    await editMsg(chatId, messageId, '⏭ Ação pulada.');
    return;
  }
}

// ── Command handlers ──────────────────────────────────────────────────────────

async function handleHelp(chatId: number): Promise<void> {
  const session = sessions.get(chatId);
  const acct = session ? `📌 Conta: <b>${session.accountName}</b>` : '⚠️ Nenhuma conta — use /conta';
  await send(chatId,
    `🤖 <b>Atlas — Comandos</b>\n${acct}\n\n` +
    `/conta — Selecionar conta de anúncios\n` +
    `/status — Performance dos últimos 7 dias\n` +
    `/otimizar — Analisar e propor otimizações\n` +
    `/relatorio — Gerar e enviar relatório semanal PDF\n` +
    `/ajuda — Esta mensagem\n\n` +
    `💬 Ou me envie qualquer mensagem para conversar com o Atlas.`
  );
}

async function handleSelectAccount(chatId: number, trafficService: TrafficService): Promise<void> {
  await send(chatId, '⏳ Buscando contas...');
  let accounts: any[] = [];
  try {
    accounts = await trafficService.getAccounts('erick');
  } catch (err: any) {
    await send(chatId, `❌ Não foi possível buscar contas: ${err.message}`);
    return;
  }

  const active = accounts.filter(a => a.account_status === 1).slice(0, 10);
  if (active.length === 0) { await send(chatId, '❌ Nenhuma conta ativa encontrada.'); return; }

  const keyboard: any[][] = active.map(acc => {
    const selId = Math.random().toString(36).slice(2, 10);
    pendingSel.set(selId, { workspaceId: 'erick', accountId: acc.id, name: acc.name });
    return [{ text: acc.name, callback_data: `sel:${selId}` }];
  });

  await send(chatId, '📊 <b>Selecione a conta de anúncios:</b>', { inline_keyboard: keyboard });
}

async function handleStatus(chatId: number, trafficService: TrafficService): Promise<void> {
  const session = sessions.get(chatId);
  if (!session) { await send(chatId, '⚠️ Use /conta para selecionar uma conta primeiro.'); return; }

  await send(chatId, `⏳ Buscando dados de <b>${session.accountName}</b>...`);
  try {
    const [insights, campaigns] = await Promise.all([
      trafficService.getAccountInsights(session.accountId, session.workspaceId, 'last_7d'),
      trafficService.getCampaigns(session.accountId, session.workspaceId),
    ]);
    const active = campaigns.filter((c: any) => c.status === 'ACTIVE');
    const fmt = (v: number) => `R$ ${v.toFixed(2)}`;
    await send(chatId,
      `📊 <b>${session.accountName} — últimos 7 dias</b>\n\n` +
      `💰 Gasto: <b>${fmt(insights.total_spend)}</b>\n` +
      `👁 Impressões: ${insights.total_impressions.toLocaleString('pt-BR')}\n` +
      `🖱 Cliques: ${insights.total_clicks.toLocaleString('pt-BR')}\n` +
      `📈 CTR: <b>${insights.avg_ctr.toFixed(2)}%</b>\n` +
      `💵 CPC: <b>${fmt(insights.avg_cpc)}</b>\n` +
      `🎯 ROAS: <b>${insights.avg_roas.toFixed(2)}x</b>\n\n` +
      `🟢 ${active.length} de ${campaigns.length} campanhas ativas`
    );
  } catch (err: any) {
    await send(chatId, `❌ Erro ao buscar dados: ${err.message}`);
  }
}

async function handleOtimizar(chatId: number, trafficService: TrafficService): Promise<void> {
  const session = sessions.get(chatId);
  if (!session) { await send(chatId, '⚠️ Use /conta para selecionar uma conta primeiro.'); return; }

  const mode = isAtlasWriteEnabled() ? '⚡ produção' : '🔒 simulação';
  await send(chatId, `🧠 Atlas analisando <b>${session.accountName}</b> (${mode})...\n⏳ Aguarde ~30 segundos.`);

  try {
    const [insights, campaigns] = await Promise.all([
      trafficService.getAccountInsights(session.accountId, session.workspaceId, 'last_7d'),
      trafficService.getCampaigns(session.accountId, session.workspaceId),
    ]);

    const ctx: AtlasContext = { workspace: session.workspaceId, accountId: session.accountId, insights, campaigns };
    const { proposals, analysis } = await atlasGetProposedActions(ctx, trafficService);

    if (proposals.length === 0) {
      const snippet = analysis.replace(/<[^>]+>/g, '').slice(0, 600);
      await send(chatId, `✅ <b>Nenhuma ação necessária agora.</b>\n\n<i>${snippet}</i>`);
      return;
    }

    await send(chatId, `🎯 <b>Atlas propõe ${proposals.length} ação(ões). Aprove cada uma:</b>`);

    for (const proposal of proposals) {
      const actionId = Math.random().toString(36).slice(2, 14);
      pendingActions.set(actionId, {
        action: proposal.action,
        ctx: { workspaceId: session.workspaceId, accountId: session.accountId, campaigns, insights },
        chatId,
        expiresAt: Date.now() + 6 * 60 * 60 * 1000,
      });
      const name   = proposal.entityName ? ` <b>"${proposal.entityName}"</b>` : '';
      const reason = proposal.action.reason ? `\n└ <i>${proposal.action.reason}</i>` : '';
      await send(chatId,
        `${proposal.label}${name}${reason}`,
        { inline_keyboard: [[
          { text: '✅ Executar', callback_data: `ok:${actionId}` },
          { text: '❌ Pular',    callback_data: `no:${actionId}` },
        ]] }
      );
    }
  } catch (err: any) {
    await send(chatId, `❌ Erro ao analisar: ${err.message}`);
  }
}

async function handleRelatorio(chatId: number, trafficService: TrafficService): Promise<void> {
  const session = sessions.get(chatId);
  if (!session) { await send(chatId, '⚠️ Use /conta para selecionar uma conta primeiro.'); return; }

  await send(chatId, `⏳ Gerando relatório de <b>${session.accountName}</b>...`);
  try {
    const secret = process.env.SCHEDULER_SECRET;
    const port   = process.env.PORT ?? '3001';
    const res = await fetch(`http://localhost:${port}/api/tasks/weekly-report`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${secret}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: session.workspaceId, accountId: session.accountId }),
    });
    if (res.ok) {
      await send(chatId, '✅ Relatório enviado!');
    } else {
      const err = await res.json() as any;
      await send(chatId, `❌ Erro: ${err?.error ?? res.statusText}`);
    }
  } catch (err: any) {
    await send(chatId, `❌ Erro ao gerar relatório: ${err.message}`);
  }
}

// ── Atlas chat (free text) ────────────────────────────────────────────────────

async function handleAtlasChat(chatId: number, text: string, trafficService: TrafficService): Promise<void> {
  const session = sessions.get(chatId);
  if (!session) {
    await send(chatId, `👋 Olá! Sou o Atlas, seu gestor de tráfego.\n\nUse /conta para selecionar uma conta e começar.`);
    return;
  }

  // Use cached context (5 min TTL)
  const cacheAge = session._cache ? Date.now() - session._cache.cachedAt : Infinity;
  let insights = session._cache?.insights;
  let campaigns = session._cache?.campaigns;
  if (cacheAge > 5 * 60 * 1000) {
    try {
      [insights, campaigns] = await Promise.all([
        trafficService.getAccountInsights(session.accountId, session.workspaceId, 'last_7d'),
        trafficService.getCampaigns(session.accountId, session.workspaceId),
      ]);
      session._cache = { insights, campaigns, cachedAt: Date.now() };
    } catch { /* proceed without fresh data */ }
  }

  const ctx: AtlasContext = { workspace: session.workspaceId, accountId: session.accountId, accountName: session.accountName, insights, campaigns };

  try {
    const { reply, actionExecuted } = await atlasChat(text, session.history, ctx, trafficService, !isAtlasWriteEnabled());
    session.history.push({ role: 'user', content: text });
    session.history.push({ role: 'assistant', content: reply });
    if (session.history.length > 20) session.history.splice(0, session.history.length - 20);

    const truncated = reply.length > 4000 ? reply.slice(0, 3950) + '\n...' : reply;
    await send(chatId, truncated);

    if (actionExecuted && !actionExecuted.startsWith('[DRY') && !actionExecuted.startsWith('[MODO')) {
      await send(chatId, `⚡ <b>Ação executada:</b> ${actionExecuted}`);
    }
  } catch (err: any) {
    await send(chatId, `❌ Erro: ${err.message}`);
  }
}

// Suppress unused import warning — ProposedAction is re-exported for consumers
export type { ProposedAction };
