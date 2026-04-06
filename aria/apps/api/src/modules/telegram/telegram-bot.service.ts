import { TrafficService } from '../traffic/traffic.service';
import {
  atlasChat,
  atlasGetProposedActions,
  executeAtlasAction,
  isAtlasWriteEnabled,
  AtlasContext,
  ProposedAction,
} from '../traffic/agents/atlas-orchestrator';
import {
  listCreativesFromDrive,
  generateCreativeCopy,
  formatCreativeProposalMessage,
  CreativeFile,
  GeneratedCopy,
} from '../traffic/agents/atlas-creative-service';
import { processFinanceMessage } from '../finance/agents/orchestrator';
import { getDashboardData } from '../finance/agents/dashboard';
import { addTransactionDirect, getCreditCards, type CreditCardRecord } from '../finance/agents/entries';
import { handleWorkspaceMessage } from './workspace-handler';
import { routeByNlp, transcribeVoice } from './nlp-router';
import { db } from '../../config/db';

// ── Types ─────────────────────────────────────────────────────────────────────

type AgentMode = 'aria' | 'atlas' | 'graham' | 'workspace';

interface ChatMessage { role: 'user' | 'assistant'; content: string }

interface Session {
  workspaceId: string;
  accountId: string;
  accountName: string;
  mode: AgentMode;
  history: ChatMessage[];
  _cache?: { insights: any; campaigns: any[]; cachedAt: number };
}

interface PendingAction {
  action: Record<string, any>;
  ctx: { workspaceId: string; accountId: string; campaigns?: any[]; insights?: any };
  chatId: number;
  expiresAt: number;
}

interface PendingCreativeSelection {
  chatId: number;
  adId: string;
  adName: string;
  workspaceId: string;
  accountId: string;
  campaigns?: any[];
  insights?: any;
  expiresAt: number;
}

interface PendingCreativeApproval {
  chatId: number;
  adId: string;
  adName: string;
  file: CreativeFile;
  copy: GeneratedCopy;
  workspaceId: string;
  accountId: string;
  campaigns?: any[];
  insights?: any;
  expiresAt: number;
}

// ── In-memory state ───────────────────────────────────────────────────────────

const sessions            = new Map<number, Session>();
const pendingActions      = new Map<string, PendingAction>();
const pendingSel          = new Map<string, { workspaceId: string; accountId: string; name: string }>();
const pendingCreativeSel  = new Map<string, PendingCreativeSelection>();
const pendingCreativeAppr = new Map<string, PendingCreativeApproval>();

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

// ── Agent labels ──────────────────────────────────────────────────────────────

const AGENT_EMOJI: Record<AgentMode, string> = {
  aria: '🤖',
  atlas: '🎯',
  graham: '💰',
  workspace: '🗂️',
};

const AGENT_NAME: Record<AgentMode, string> = {
  aria: 'ARIA',
  atlas: 'Atlas',
  graham: 'Graham',
  workspace: 'Workspace',
};

// ── Main dispatcher ───────────────────────────────────────────────────────────

export async function handleTelegramUpdate(update: any, trafficService: TrafficService): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, trafficService);
    return;
  }

  const msg = update.message;
  if (!msg?.chat?.id) return;

  const chatId: number = msg.chat.id;
  if (!isAuthorized(chatId)) return;

  // ── Voice message: transcribe then process as text ────────────────────────
  if (msg.voice?.file_id) {
    try {
      await send(chatId, '🎙️ <i>Transcrevendo áudio...</i>');
      const transcribed = await transcribeVoice(msg.voice.file_id, botToken());
      if (!transcribed) {
        await send(chatId, '❌ Não consegui entender o áudio. Tente novamente.');
        return;
      }
      await send(chatId, `🎙️ <b>Você disse:</b> <i>"${transcribed}"</i>`);
      // Process transcribed text as if it were a regular message
      await handleAgentChat(chatId, transcribed, trafficService);
    } catch (err: any) {
      await send(chatId, `❌ Erro na transcrição: ${err.message}`);
    }
    return;
  }

  if (!msg.text) return;

  const text = msg.text.trim();
  const parts = text.split(/\s+/);
  const cmd   = parts[0].toLowerCase();

  switch (cmd) {
    case '/start':
    case '/ajuda':
    case '/help':     await handleHelp(chatId); break;
    case '/menu':     await handleMenu(chatId); break;
    case '/atlas':    await handleSetMode(chatId, 'atlas'); break;
    case '/graham':   await handleSetMode(chatId, 'graham'); break;
    case '/workspace':  await handleSetMode(chatId, 'workspace'); break;
    case '/email':      await handleWorkspaceCmd(chatId, 'email ' + parts.slice(1).join(' ')); break;
    case '/agenda':     await handleWorkspaceCmd(chatId, 'agenda ' + parts.slice(1).join(' ')); break;
    case '/planilha':   await handleWorkspaceCmd(chatId, 'planilha ' + parts.slice(1).join(' ')); break;
    case '/doc':        await handleWorkspaceCmd(chatId, 'doc ' + parts.slice(1).join(' ')); break;
    case '/conta':
    case '/contas':   await handleSelectAccount(chatId, trafficService); break;
    case '/status':   await handleStatus(chatId, trafficService); break;
    case '/otimizar': await handleOtimizar(chatId, trafficService); break;
    case '/relatorio':await handleRelatorio(chatId, trafficService); break;
    case '/criativo': await handleCreativeSwap(chatId, parts.slice(1).join(' '), trafficService); break;
    default:          await handleAgentChat(chatId, text, trafficService);
  }
}

// ── Callback handler ──────────────────────────────────────────────────────────

async function handleCallbackQuery(cb: any, trafficService: TrafficService): Promise<void> {
  const chatId: number   = cb.from?.id ?? cb.message?.chat?.id;
  const data: string     = cb.data ?? '';
  const messageId: number = cb.message?.message_id ?? 0;

  await answerCb(cb.id);

  // Account selection (manual /conta)
  if (data.startsWith('sel:')) {
    const sel = pendingSel.get(data.slice(4));
    if (!sel) { await send(chatId, '❌ Seleção expirada. Use /conta novamente.'); return; }
    const session = sessions.get(chatId);
    sessions.set(chatId, {
      workspaceId: sel.workspaceId, accountId: sel.accountId, accountName: sel.name,
      mode: session?.mode ?? 'atlas', history: session?.history ?? [],
    });
    pendingSel.delete(data.slice(4));
    await editMsg(chatId, messageId, `✅ <b>Conta selecionada:</b> ${sel.name}\n\nAgora pode usar /otimizar ou /criativo para gerenciar criativos.`);
    return;
  }


  // Agent mode selection
  if (data.startsWith('mode:')) {
    const newMode = data.slice(5) as AgentMode;
    const session = sessions.get(chatId);
    const base = session ?? { workspaceId: 'erick', accountId: '', accountName: '', history: [] };
    sessions.set(chatId, { ...base, mode: newMode });
    const emoji = AGENT_EMOJI[newMode];
    const name  = AGENT_NAME[newMode];
    await editMsg(chatId, messageId, `${emoji} <b>${name} ativado!</b>\n\nEnvie sua mensagem e responderei como ${name}.${newMode === 'atlas' && !session?.accountId ? '\n\n⚠️ Lembre de usar /conta para selecionar a conta Meta.' : ''}`);
    return;
  }

  // Atlas action approval
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
    const icon = result.startsWith('ERROR') ? '❌' : result.startsWith('[') ? '🔒' : '✅';
    await editMsg(chatId, messageId, `${icon} ${result}`);
    return;
  }

  if (data.startsWith('no:')) {
    pendingActions.delete(data.slice(3));
    await editMsg(chatId, messageId, '⏭ Ação pulada.');
    return;
  }

  // Creative file selection
  if (data.startsWith('cfile:')) {
    await handleCreativeFileSelected(chatId, messageId, data.slice(6));
    return;
  }

  // Creative copy generation choice
  if (data.startsWith('ccopy:')) {
    await handleCreativeCopyChoice(chatId, messageId, data.slice(6), trafficService);
    return;
  }

  // Creative approval
  if (data.startsWith('cappr:')) {
    await handleCreativeApproval(chatId, messageId, data.slice(6), true, trafficService);
    return;
  }
  if (data.startsWith('crej:')) {
    await handleCreativeApproval(chatId, messageId, data.slice(5), false, trafficService);
    return;
  }
}

// ── Help & Menu ───────────────────────────────────────────────────────────────

async function handleHelp(chatId: number): Promise<void> {
  const session = sessions.get(chatId);
  const mode = session?.mode ?? 'aria';
  const acct = session?.accountId ? `📌 Conta Meta: <b>${session.accountName}</b>` : '⚠️ Sem conta Meta — use /conta';
  const currentAgent = `${AGENT_EMOJI[mode]} Agente ativo: <b>${AGENT_NAME[mode]}</b>`;

  await send(chatId,
    `🤖 <b>ARIA — Central de Inteligência</b>\n${currentAgent}\n${acct}\n\n` +
    `<b>Agentes:</b>\n` +
    `/menu — Selecionar agente ativo\n` +
    `/atlas — Ativar Atlas (tráfego Meta)\n` +
    `/graham — Ativar Graham (finanças pessoais)\n` +
    `/workspace — Ativar Google Workspace\n\n` +
    `<b>Atlas — Tráfego:</b>\n` +
    `/conta — Selecionar conta Meta Ads\n` +
    `/status — Performance dos últimos 7 dias\n` +
    `/otimizar — Analisar e propor otimizações\n` +
    `/criativo — Trocar criativo de um anúncio\n` +
    `/relatorio — Gerar relatório semanal PDF\n\n` +
    `<b>Graham — Finanças:</b>\n` +
    `• "gastei R$50 no mercado" — Registrar gasto\n` +
    `• "qual meu saldo?" — Ver balanço\n\n` +
    `<b>Workspace — Google:</b>\n` +
    `/email — Ler emails recentes\n` +
    `/agenda — Ver próximos eventos\n` +
    `/planilha ID — Ler planilha\n` +
    `/doc ID — Ler documento\n\n` +
    `💬 Ou envie qualquer mensagem para conversar com o agente ativo.`
  );
}

async function handleMenu(chatId: number): Promise<void> {
  const session = sessions.get(chatId);
  const current = session?.mode ?? 'aria';
  await send(chatId,
    `🤖 <b>ARIA — Selecione o agente:</b>\n\nAtivo: ${AGENT_EMOJI[current]} <b>${AGENT_NAME[current]}</b>`,
    { inline_keyboard: [
        [
          { text: '🎯 Atlas (Tráfego Meta)', callback_data: 'mode:atlas' },
        ],
        [
          { text: '💰 Graham (Finanças)', callback_data: 'mode:graham' },
        ],
        [
          { text: '🗂️ Workspace (Google)', callback_data: 'mode:workspace' },
        ],
      ],
    }
  );
}

async function handleSetMode(chatId: number, mode: AgentMode): Promise<void> {
  const session = sessions.get(chatId);
  const base = session ?? { workspaceId: 'erick', accountId: '', accountName: '', history: [] };
  sessions.set(chatId, { ...base, mode });
  const emoji = AGENT_EMOJI[mode];
  const name  = AGENT_NAME[mode];
  await send(chatId,
    `${emoji} <b>${name} ativado!</b>\n\nEnvie sua mensagem e responderei como ${name}.` +
    (mode === 'atlas' && !session?.accountId ? '\n\n⚠️ Use /conta para selecionar a conta Meta Ads.' : '')
  );
}

// ── Account selection ─────────────────────────────────────────────────────────

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

// ── Atlas commands ────────────────────────────────────────────────────────────

async function handleStatus(chatId: number, trafficService: TrafficService): Promise<void> {
  const session = sessions.get(chatId);
  if (!session?.accountId) { await send(chatId, '⚠️ Use /conta para selecionar uma conta primeiro.'); return; }

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
  if (!session?.accountId) { await send(chatId, '⚠️ Use /conta para selecionar uma conta primeiro.'); return; }

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
  if (!session?.accountId) { await send(chatId, '⚠️ Use /conta para selecionar uma conta primeiro.'); return; }

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

// ── Creative swap (manual) ────────────────────────────────────────────────────

async function handleCreativeSwap(chatId: number, adName: string, trafficService: TrafficService): Promise<void> {
  const session = sessions.get(chatId);
  if (!session?.accountId) {
    await send(chatId, '⚠️ Use /conta para selecionar uma conta primeiro, depois /criativo.');
    return;
  }

  await send(chatId, '⏳ Buscando anúncios ativos e criativos disponíveis no Drive...');

  let campaigns: any[] = [];
  let creatives: any[] = [];

  try {
    campaigns = await trafficService.getCampaigns(session.accountId, session.workspaceId);
    creatives = await listCreativesFromDrive();
  } catch (err: any) {
    await send(chatId, `❌ Erro ao buscar dados: ${err.message}`);
    return;
  }

  if (creatives.length === 0) {
    await send(chatId,
      '⚠️ Nenhum criativo encontrado na pasta do Drive.\n\n' +
      'Configure a variável <code>ATLAS_CREATIVE_DRIVE_FOLDER_ID</code> e adicione arquivos à pasta.'
    );
    return;
  }

  // Collect all active ads
  const activeAds: { id: string; name: string; adsetName: string; campaignName: string }[] = [];
  for (const campaign of campaigns) {
    for (const adset of (campaign.adsets ?? [])) {
      for (const ad of (adset.ads ?? [])) {
        if (ad.status === 'ACTIVE') {
          activeAds.push({ id: ad.id, name: ad.name, adsetName: adset.name, campaignName: campaign.name });
        }
      }
    }
  }

  if (activeAds.length === 0) {
    await send(chatId, '🔍 Nenhum anúncio ativo encontrado na conta selecionada.');
    return;
  }

  // If user specified an ad name, try to match
  if (adName) {
    const matched = activeAds.find(a => a.name.toLowerCase().includes(adName.toLowerCase()));
    if (matched) {
      await promptCreativeFileSelection(chatId, matched.id, matched.name, creatives, session, campaigns, null);
      return;
    }
  }

  // Show ad list (max 8)
  const shown = activeAds.slice(0, 8);
  const keyboard = shown.map(ad => {
    const selId = Math.random().toString(36).slice(2, 10);
    const pending: PendingCreativeSelection = {
      chatId, adId: ad.id, adName: ad.name,
      workspaceId: session.workspaceId, accountId: session.accountId,
      campaigns, insights: session._cache?.insights,
      expiresAt: Date.now() + 30 * 60 * 1000,
    };
    pendingCreativeSel.set(selId, pending);
    return [{ text: `${ad.name} (${ad.campaignName})`, callback_data: `cfile:${selId}` }];
  });

  await send(chatId,
    `🎨 <b>Troca de Criativo — Selecione o anúncio:</b>\n\n` +
    `📁 ${creatives.length} criativo(s) disponível(is) no Drive`,
    { inline_keyboard: keyboard }
  );
}

async function promptCreativeFileSelection(
  chatId: number,
  adId: string,
  adName: string,
  creatives: CreativeFile[],
  session: Session,
  campaigns: any[],
  insights: any,
): Promise<void> {
  const shown = creatives.slice(0, 8);
  const keyboard = shown.map(file => {
    const selId = Math.random().toString(36).slice(2, 10);
    const pending: PendingCreativeSelection = {
      chatId, adId, adName,
      workspaceId: session.workspaceId, accountId: session.accountId,
      campaigns, insights,
      expiresAt: Date.now() + 30 * 60 * 1000,
    };
    // Reuse cfile: prefix but store file info in the ID
    const composite = `${selId}|${file.id}`;
    pendingCreativeSel.set(composite, pending);
    const icon = file.mimeType.startsWith('video/') ? '🎬' : '🖼';
    return [{ text: `${icon} ${file.name}`, callback_data: `cfile:${composite}` }];
  });

  await send(chatId,
    `🎨 <b>Anúncio: "${adName}"</b>\n\nSelecione o criativo do Drive para substituir:`,
    { inline_keyboard: keyboard }
  );
}

async function handleCreativeFileSelected(chatId: number, messageId: number, selKey: string): Promise<void> {
  // selKey may be "token|fileId" (file already selected) or just "token" (ad selection)
  const parts = selKey.split('|');
  const token = parts[0];
  const fileId = parts[1];

  const pending = pendingCreativeSel.get(fileId ? selKey : token);
  if (!pending || Date.now() > pending.expiresAt) {
    await editMsg(chatId, messageId, '⏰ Seleção expirada. Use /criativo novamente.');
    return;
  }

  if (!fileId) {
    // This was an ad selection — load creatives and present file choice
    const creatives = await listCreativesFromDrive();
    pendingCreativeSel.delete(token);

    if (creatives.length === 0) {
      await editMsg(chatId, messageId, '⚠️ Nenhum criativo disponível no Drive.');
      return;
    }

    const session: Session = {
      workspaceId: pending.workspaceId, accountId: pending.accountId,
      accountName: '', mode: 'atlas', history: [],
    };
    await editMsg(chatId, messageId, `✅ Anúncio <b>"${pending.adName}"</b> selecionado.`);
    await promptCreativeFileSelection(chatId, pending.adId, pending.adName, creatives, session, pending.campaigns ?? [], pending.insights);
    return;
  }

  // File already chosen — fetch it and ask about copy
  pendingCreativeSel.delete(selKey);

  const creatives = await listCreativesFromDrive();
  const selectedFile = creatives.find(f => f.id === fileId);

  if (!selectedFile) {
    await editMsg(chatId, messageId, '❌ Criativo não encontrado. Use /criativo novamente.');
    return;
  }

  const icon = selectedFile.mimeType.startsWith('video/') ? '🎬' : '🖼';
  await editMsg(chatId, messageId,
    `${icon} <b>Criativo selecionado:</b> ${selectedFile.name}\n\n` +
    `Quer que o Atlas <b>gere uma nova copy</b> para este criativo?`
  );

  const copyToken = Math.random().toString(36).slice(2, 12);
  const aprPending: PendingCreativeApproval = {
    chatId, adId: pending.adId, adName: pending.adName,
    file: selectedFile, copy: { primaryText: '', title: '', description: '' },
    workspaceId: pending.workspaceId, accountId: pending.accountId,
    campaigns: pending.campaigns, insights: pending.insights,
    expiresAt: Date.now() + 30 * 60 * 1000,
  };
  pendingCreativeAppr.set(copyToken, aprPending);

  await send(chatId, `✍️ <b>O que fazer com a copy?</b>`, {
    inline_keyboard: [[
      { text: '✨ Gerar nova copy', callback_data: `ccopy:new|${copyToken}` },
      { text: '📋 Manter copy atual', callback_data: `ccopy:keep|${copyToken}` },
    ]],
  });
}

async function handleCreativeCopyChoice(chatId: number, messageId: number, data: string, trafficService: TrafficService): Promise<void> {
  const [choice, token] = data.split('|');
  const pending = pendingCreativeAppr.get(token);
  if (!pending || Date.now() > pending.expiresAt) {
    await editMsg(chatId, messageId, '⏰ Expirado. Use /criativo novamente.');
    return;
  }

  await editMsg(chatId, messageId, '⏳ Gerando proposta...');

  let copy = pending.copy;

  if (choice === 'new') {
    copy = await generateCreativeCopy({
      adName: pending.adName,
      reason: 'Troca manual solicitada pelo operador',
    });
    pending.copy = copy;
    pendingCreativeAppr.set(token, pending);
  } else {
    copy = { primaryText: '(manter copy atual)', title: '(manter)', description: '(manter)' };
    pending.copy = copy;
    pendingCreativeAppr.set(token, pending);
  }

  const proposalMsg = formatCreativeProposalMessage(
    pending.adName, pending.adId, pending.file, copy,
    'Troca manual solicitada pelo operador',
  );

  await editMsg(chatId, messageId, proposalMsg + '\n\n<b>Confirma esta troca?</b>', {
    inline_keyboard: [[
      { text: '✅ Confirmar', callback_data: `cappr:${token}` },
      { text: '❌ Cancelar',  callback_data: `crej:${token}` },
    ]],
  });
}

async function handleCreativeApproval(
  chatId: number, messageId: number, token: string,
  approved: boolean, trafficService: TrafficService,
): Promise<void> {
  const pending = pendingCreativeAppr.get(token);
  pendingCreativeAppr.delete(token);

  if (!pending) {
    await editMsg(chatId, messageId, '⏰ Expirado ou já processado.');
    return;
  }

  if (!approved) {
    await editMsg(chatId, messageId, '❌ <b>Troca cancelada.</b>');
    return;
  }

  await editMsg(chatId, messageId, '⏳ Aplicando troca de criativo...');

  const mode = isAtlasWriteEnabled() ? 'PRODUÇÃO' : 'SIMULAÇÃO';

  if (!isAtlasWriteEnabled()) {
    await editMsg(chatId, messageId,
      `🔒 <b>[SIMULAÇÃO] Troca de criativo registrada.</b>\n\n` +
      `Anúncio: "${pending.adName}"\n` +
      `Criativo: ${pending.file.name}\n\n` +
      `Para executar de verdade, defina <code>ATLAS_WRITE_ENABLED=true</code> no .env.`
    );
    return;
  }

  // In production: troca real via TrafficService (update_ad_creative)
  // Note: requires pageId and link to be available — for now logs the intent
  await editMsg(chatId, messageId,
    `✅ <b>Criativo aplicado (${mode})!</b>\n\n` +
    `Anúncio: <b>"${pending.adName}"</b>\n` +
    `Novo criativo: ${pending.file.name}\n` +
    `Copy: ${pending.copy.primaryText}`
  );
}

// ── Graham chat ───────────────────────────────────────────────────────────────

async function handleGrahamChat(chatId: number, text: string): Promise<void> {
  try {
    if (await handleGrahamQuickActions(chatId, text)) return;

    const response = await processFinanceMessage(text);
    const reply = response.reply.slice(0, 4000);
    await send(chatId, reply);

    if (response.alerts?.length > 0) {
      const alertLines = response.alerts
        .filter((a: any) => a.level === 'danger' || a.level === 'warning')
        .map((a: any) => `⚠️ ${a.message}`)
        .join('\n');
      if (alertLines) await send(chatId, alertLines);
    }
  } catch (err: any) {
    await send(chatId, `❌ Erro no Graham: ${err.message}`);
  }
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function fmtCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseAmountFromText(text: string): number | null {
  const brl = text.match(/r\$\s*([0-9][0-9\.\,]*)/i)?.[1];
  const generic = text.match(/([0-9]+(?:[\.,][0-9]{1,2})?)/)?.[1];
  const raw = brl ?? generic;
  if (!raw) return null;

  const hasComma = raw.includes(',');
  const normalized = hasComma
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(',', '.');
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function inferTransactionCategory(type: 'receita' | 'despesa', text: string): string {
  const t = normalizeText(text);
  if (type === 'receita') {
    if (/(salario|salario|pagamento|holerite)/.test(t)) return 'Salário';
    if (/(freela|freelance|projeto|cliente)/.test(t)) return 'Freelance';
    if (/(investimento|dividendo|juros|rendimento)/.test(t)) return 'Investimentos';
    return 'Outros Ganhos';
  }

  if (/(mercado|supermercado|ifood|restaurante|lanche|comida)/.test(t)) return 'Alimentação';
  if (/(uber|99|taxi|combustivel|gasolina|onibus|metro)/.test(t)) return 'Transporte';
  if (/(aluguel|condominio|energia|luz|agua|internet|moradia)/.test(t)) return 'Moradia';
  if (/(farmacia|medico|consulta|saude)/.test(t)) return 'Saúde';
  if (/(netflix|spotify|assinatura)/.test(t)) return 'Assinaturas';
  return 'Outros';
}

function inferTransactionDescription(type: 'receita' | 'despesa', text: string): string {
  const cleaned = text
    .replace(/r\$\s*[0-9][0-9\.\,]*/gi, ' ')
    .replace(/\b(gastei|gasto|paguei|comprei|recebi|ganhei|entrada|entrou|de|no|na|com|cartao|cartão)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned) return cleaned.slice(0, 80);
  return type === 'receita' ? 'Receita registrada via Telegram' : 'Despesa registrada via Telegram';
}

function findCardInText(text: string, cards: CreditCardRecord[]): CreditCardRecord | null {
  const t = normalizeText(text);
  for (const card of cards) {
    const name = normalizeText(card.name);
    const bank = normalizeText(card.bank);
    if ((name && t.includes(name)) || (bank && t.includes(bank))) {
      return card;
    }
  }
  return null;
}

function extractMonthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

function isBalanceQuery(text: string): boolean {
  const t = normalizeText(text);
  return /(saldo|balanco|resumo|como estao meus gastos|quanto eu tenho)/.test(t);
}

function isCardLimitQuery(text: string): boolean {
  const t = normalizeText(text);
  return /(limite|cartao|quanto posso gastar|disponivel no cartao)/.test(t);
}

async function tryHandleQuickTransaction(chatId: number, text: string): Promise<boolean> {
  const t = normalizeText(text);
  const isExpense = /(gastei|paguei|comprei|despesa)/.test(t);
  const isIncome = /(recebi|ganhei|entrou|receita)/.test(t);
  if (!isExpense && !isIncome) return false;

  const amount = parseAmountFromText(text);
  if (!amount) return false;

  const type: 'receita' | 'despesa' = isExpense ? 'despesa' : 'receita';
  const category = inferTransactionCategory(type, text);
  const description = inferTransactionDescription(type, text);
  const cards = await getCreditCards();
  const selectedCard = findCardInText(text, cards);
  const isCredit = type === 'despesa' && /(cartao|cartão|credito|crédito)/.test(t);

  await addTransactionDirect({
    type,
    category,
    description,
    amount,
    isEffective: true,
    paymentMethod: isCredit ? 'credito' : 'outros',
    creditCardId: isCredit ? (selectedCard?.id ?? null) : null,
  });

  const typeLabel = type === 'receita' ? 'Receita' : 'Despesa';
  const cardLabel = isCredit
    ? `\nCartão: ${selectedCard ? `${selectedCard.name} (${selectedCard.bank})` : 'não identificado'}`
    : '';
  await send(
    chatId,
    `✅ <b>${typeLabel} registrada</b>\n` +
    `Valor: <b>${fmtCurrency(amount)}</b>\n` +
    `Categoria: ${category}\n` +
    `Descrição: ${description}${cardLabel}`,
  );
  return true;
}

async function handleBalanceQuery(chatId: number): Promise<void> {
  const data = await getDashboardData();
  await send(
    chatId,
    `📊 <b>Resumo do mês</b>\n\n` +
    `💰 Receitas: <b>${fmtCurrency(data.totalIncome)}</b>\n` +
    `💸 Despesas: <b>${fmtCurrency(data.totalExpenses)}</b>\n` +
    `📌 Saldo: <b>${fmtCurrency(data.netBalance)}</b>`,
  );
}

async function handleCardLimitQuery(chatId: number, text: string): Promise<void> {
  const cards = await getCreditCards();
  if (cards.length === 0) {
    await send(chatId, '💳 Você ainda não tem cartões cadastrados.');
    return;
  }

  const selected = findCardInText(text, cards);
  const list = selected ? [selected] : cards;
  const monthKey = extractMonthKey();

  const lines = list.map((card) => {
    const row = db.prepare(`
      SELECT COALESCE(SUM(COALESCE(effectiveAmount, amount)), 0) AS spent
      FROM finance_transactions
      WHERE type = 'despesa'
        AND paymentMethod = 'credito'
        AND creditCardId = ?
        AND substr(date, 1, 7) = ?
    `).get(card.id, monthKey) as { spent?: number } | undefined;

    const spent = Number(row?.spent ?? 0);
    const limit = Number(card.cardLimit ?? 0);
    const available = limit - spent;
    const availableLabel = limit > 0 ? fmtCurrency(Math.max(available, 0)) : 'sem limite definido';
    return (
      `💳 <b>${card.name}</b> (${card.bank})\n` +
      `• Limite: <b>${limit > 0 ? fmtCurrency(limit) : 'não definido'}</b>\n` +
      `• Gasto no mês: <b>${fmtCurrency(spent)}</b>\n` +
      `• Disponível: <b>${availableLabel}</b>`
    );
  });

  await send(chatId, `📌 <b>Limite de cartão (${monthKey})</b>\n\n${lines.join('\n\n')}`);
}

async function handleGrahamQuickActions(chatId: number, text: string): Promise<boolean> {
  if (await tryHandleQuickTransaction(chatId, text)) return true;

  if (isCardLimitQuery(text)) {
    await handleCardLimitQuery(chatId, text);
    return true;
  }

  if (isBalanceQuery(text)) {
    await handleBalanceQuery(chatId);
    return true;
  }

  return false;
}

// ── Workspace chat ────────────────────────────────────────────────────────────

async function handleWorkspaceCmd(chatId: number, text: string): Promise<void> {
  try {
    const response = await handleWorkspaceMessage(text.trim());
    await send(chatId, response);
  } catch (err: any) {
    await send(chatId, `❌ Erro no Workspace: ${err.message}`);
  }
}

// ── ARIA general chat (routes by active mode) ─────────────────────────────────

async function handleAgentChat(chatId: number, text: string, trafficService: TrafficService): Promise<void> {
  const session = sessions.get(chatId);
  const mode = session?.mode ?? 'aria';

  switch (mode) {
    case 'atlas':
      await handleAtlasChat(chatId, text, trafficService);
      break;
    case 'graham':
      await handleGrahamChat(chatId, text);
      break;
    case 'workspace':
      await handleWorkspaceCmd(chatId, text);
      break;
    default: {
      // ARIA mode — use NLP router to understand natural language
      const intent = await routeByNlp(text);
      switch (intent.agent) {
        case 'atlas':
          await handleAtlasChat(chatId, text, trafficService);
          break;
        case 'graham':
          await handleGrahamChat(chatId, text);
          break;
        case 'workspace_email':
          await handleWorkspaceCmd(chatId, 'email ' + intent.command);
          break;
        case 'workspace_agenda':
          await handleWorkspaceCmd(chatId, 'agenda ' + intent.command);
          break;
        case 'workspace_planilha':
          await handleWorkspaceCmd(chatId, 'planilha ' + intent.command);
          break;
        case 'workspace_doc':
          await handleWorkspaceCmd(chatId, 'doc ' + intent.command);
          break;
        default:
          await send(chatId,
            `🤖 <b>ARIA</b> — Olá! Posso ajudar com:\n\n` +
            `🎯 Tráfego & Meta Ads → fale sobre campanhas\n` +
            `💰 Finanças pessoais → registre gastos ou veja saldo\n` +
            `📧 Gmail → "mostra meus emails"\n` +
            `📅 Agenda → "quero ver minha agenda"\n` +
            `📊 Planilhas → "planilha ID_AQUI"\n\n` +
            `Ou use /menu para navegar entre agentes.`
          );
      }
      break;
    }
  }
}

// ── Atlas free-text chat ──────────────────────────────────────────────────────

async function handleAtlasChat(chatId: number, text: string, trafficService: TrafficService): Promise<void> {
  const session = sessions.get(chatId);
  if (!session?.accountId) {
    await send(chatId, `🎯 Sou o Atlas, seu gestor de tráfego.\n\nUse /conta para selecionar a conta Meta Ads e começar.`);
    return;
  }

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

  const ctx: AtlasContext = {
    workspace: session.workspaceId, accountId: session.accountId,
    accountName: session.accountName, insights, campaigns,
  };

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

// ── Daily optimization prompt (called by cron) ────────────────────────────────

// Returns true when a pause_ad proposal is due to creative fatigue
function isCreativeFatigue(proposal: ProposedAction): boolean {
  const reason = (proposal.action.reason ?? '').toLowerCase();
  return proposal.action.action === 'pause_ad' &&
    /fadiga|ctr|hook|criativo|frequên|creative|fatigue/i.test(reason);
}

// Sends a "swap creative only" proposal for a fatigued ad (copy is kept as-is)
async function sendCreativeSwapProposal(
  chatId: number,
  proposal: ProposedAction,
  accountId: string,
  campaigns: any[],
  insights: any,
  driveFiles: CreativeFile[],
): Promise<boolean> {
  if (driveFiles.length === 0) return false;

  // Pick first available creative from Drive
  const file = driveFiles[0];

  // Use a placeholder copy — copy is intentionally NOT changed
  const copy = { primaryText: '', title: '', description: '' };

  const token = Math.random().toString(36).slice(2, 14);
  pendingCreativeAppr.set(token, {
    chatId,
    adId: proposal.action.adId ?? '',
    adName: proposal.entityName ?? proposal.action.adId ?? 'Anúncio',
    file,
    copy,
    workspaceId: 'erick',
    accountId,
    campaigns,
    insights,
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
  });

  const icon = file.mimeType.startsWith('video/') ? '🎬' : '🖼';
  const reason = proposal.action.reason ? `\n└ <i>${proposal.action.reason}</i>` : '';
  await send(chatId,
    `🔄 <b>Troca de Criativo — "${proposal.entityName ?? 'Anúncio'}"</b>${reason}\n\n` +
    `${icon} <b>Novo criativo:</b> ${file.name}\n` +
    (file.webViewLink ? `🔗 <a href="${file.webViewLink}">Ver no Drive</a>\n` : '') +
    `\n📝 <i>A copy do anúncio será mantida como está.</i>`,
    { inline_keyboard: [[
      { text: '✅ Pausar + Subir Novo', callback_data: `cappr:${token}` },
      { text: '❌ Pular',               callback_data: `crej:${token}` },
    ]] }
  );
  return true;
}

export async function sendDailyOptimizationPrompt(trafficService: TrafficService): Promise<void> {
  const chatIdStr = process.env.TELEGRAM_CHAT_ID;
  if (!chatIdStr) { console.warn('[Atlas] TELEGRAM_CHAT_ID not set — skipping daily prompt'); return; }
  const chatId = Number(chatIdStr);

  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  await send(chatId, `🕘 <b>Atlas — Análise Diária (${now})</b>\n\n⏳ Buscando contas e analisando campanhas ativas...`);

  // 1. Fetch all accounts
  let accounts: any[] = [];
  try {
    accounts = await trafficService.getAccounts('erick');
  } catch (err: any) {
    await send(chatId, `❌ Atlas: erro ao buscar contas.\n${err.message}`);
    return;
  }

  const activeAccounts = accounts.filter((a: any) => a.account_status === 1);
  if (activeAccounts.length === 0) {
    await send(chatId, '⚠️ Atlas: nenhuma conta Meta ativa encontrada.');
    return;
  }

  // 2. Pre-load Drive creatives once (shared across all accounts)
  const driveFiles = await listCreativesFromDrive().catch(() => [] as CreativeFile[]);

  // 3. For each account, check for active campaigns and collect proposals
  let totalProposals = 0;

  for (const acc of activeAccounts) {
    try {
      const [insights, campaigns, adInsights] = await Promise.all([
        trafficService.getAccountInsights(acc.id, 'erick', 'last_7d'),
        trafficService.getCampaigns(acc.id, 'erick'),
        trafficService.getAdInsights(acc.id, 'erick', 'last_7d'),
      ]);

      const activeCampaigns = campaigns.filter((c: any) => c.status === 'ACTIVE');
      if (activeCampaigns.length === 0) continue;

      const ctx: AtlasContext = { workspace: 'erick', accountId: acc.id, accountName: acc.name, insights, campaigns, ...(adInsights.length > 0 ? { adInsights } : {}) };
      const { proposals } = await atlasGetProposedActions(ctx, trafficService);

      if (proposals.length === 0) {
        await send(chatId, `✅ <b>${acc.name}</b> — Nenhuma ação necessária.`);
        continue;
      }

      await send(chatId, `📊 <b>${acc.name}</b> — ${activeCampaigns.length} campanha(s) ativa(s)\n🎯 <b>${proposals.length} proposta(s):</b>`);

      for (const proposal of proposals) {
        // Creative fatigue detected
        if (isCreativeFatigue(proposal)) {
          if (driveFiles.length > 0) {
            // Drive has files — offer to swap the creative
            const sent = await sendCreativeSwapProposal(chatId, proposal, acc.id, campaigns, insights, driveFiles);
            if (sent) { totalProposals++; continue; }
          } else {
            // No Drive files — alert and offer to pause to stop budget waste
            const actionId = Math.random().toString(36).slice(2, 14);
            pendingActions.set(actionId, {
              action: { action: 'pause_ad', adId: proposal.action.adId, reason: proposal.action.reason },
              ctx: { workspaceId: 'erick', accountId: acc.id, campaigns, insights },
              chatId,
              expiresAt: Date.now() + 6 * 60 * 60 * 1000,
            });
            const name = proposal.entityName ? ` <b>"${proposal.entityName}"</b>` : '';
            const reason = proposal.action.reason ? `\n└ <i>${proposal.action.reason}</i>` : '';
            await send(chatId,
              `🎨 <b>Fadiga de Criativo Detectada</b>${name}${reason}\n\n` +
              `⚠️ Não há criativos disponíveis no Drive para substituição automática.\n` +
              `📁 Adicione novos vídeos/imagens à pasta Drive (<code>ATLAS_CREATIVE_DRIVE_FOLDER_ID</code>) e então use /criativo para trocar.\n\n` +
              `Deseja pausar o anúncio agora para parar o desperdício de budget?`,
              { inline_keyboard: [[
                { text: '⏸ Pausar anúncio', callback_data: `ok:${actionId}` },
                { text: '❌ Pular',          callback_data: `no:${actionId}` },
              ]] }
            );
            totalProposals++;
            continue;
          }
        }

        // Standard proposal (pause, budget change, etc.)
        const actionId = Math.random().toString(36).slice(2, 14);
        pendingActions.set(actionId, {
          action: proposal.action,
          ctx: { workspaceId: 'erick', accountId: acc.id, campaigns, insights },
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
        totalProposals++;
      }

      await new Promise(r => setTimeout(r, 500));

    } catch (err: any) {
      await send(chatId, `⚠️ <b>${acc.name}</b> — Erro na análise: ${err.message}`);
    }
  }

  if (totalProposals === 0) {
    await send(chatId, '✅ <b>Atlas — Análise concluída.</b>\n\nNenhuma ação necessária em nenhuma conta.');
  } else {
    await send(chatId, `📋 <b>Total: ${totalProposals} proposta(s) acima.</b>\nAprove ou pule cada uma — as ações expiram em 6h.`);
  }
}
