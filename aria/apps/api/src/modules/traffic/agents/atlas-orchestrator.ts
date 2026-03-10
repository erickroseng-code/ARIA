import Groq from 'groq-sdk';
import { TrafficService, AccountInsights, Campaign } from '../traffic.service';
import { logAtlasAction } from './atlas-audit';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AtlasContext {
  workspace: string;
  accountId: string;
  accountName?: string;
  currency?: string;
  insights?: AccountInsights;
  campaigns?: Campaign[];
  datePreset?: string;
}

export interface ActionResult {
  action: string;
  entityId: string;
  result: string;
  dryRun: boolean;
}

// ─── Feature Flag ─────────────────────────────────────────────────────────────

export function isAtlasWriteEnabled(): boolean {
  return process.env.ATLAS_WRITE_ENABLED === 'true';
}

// ─── Budget Guardrail ─────────────────────────────────────────────────────────

function checkBudgetGuardrail(currentBudget: number, newBudget: number, maxVariationPct = 0.20): boolean {
  if (currentBudget === 0) return false;
  const variation = Math.abs(newBudget - currentBudget) / currentBudget;
  return variation <= maxVariationPct;
}

// ─── Action Extraction ────────────────────────────────────────────────────────

function extractAction(text: string): Record<string, any> | null {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractAllActions(text: string): Record<string, any>[] {
  const regex = /```json\s*([\s\S]*?)\s*```/g;
  const actions: Record<string, any>[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.action) actions.push(parsed);
    } catch { /* skip invalid JSON blocks */ }
  }
  return actions;
}

// ─── Shared Action Executor ───────────────────────────────────────────────────

interface ExecuteActionOptions {
  dryRun?: boolean;
  /** When provided, action is logged to atlas_audit_log after execution */
  logContext?: { workspaceId: string; triggeredBy: 'scheduler' | 'chat' };
}

async function executeAction(
  action: Record<string, any>,
  ctx: AtlasContext,
  trafficService: TrafficService,
  options: ExecuteActionOptions = {}
): Promise<string> {
  const { dryRun = false, logContext } = options;

  // Feature flag + dry-run gate
  if (!isAtlasWriteEnabled() || dryRun) {
    const mode = dryRun ? 'DRY-RUN' : 'MODO SEGURO';
    return `[${mode}] Ação simulada: ${action.action}`;
  }

  let result: string;

  try {
    if (action.action === 'pause_campaign' && action.campaignId) {
      await trafficService.pauseCampaign(action.campaignId, ctx.workspace);
      result = `Campanha ${action.campaignId} pausada.`;

    } else if (action.action === 'enable_campaign' && action.campaignId) {
      await trafficService.enableCampaign(action.campaignId, ctx.workspace);
      result = `Campanha ${action.campaignId} ativada.`;

    } else if (action.action === 'update_budget' && action.campaignId && action.dailyBudget) {
      // Budget guardrail: check variation against current budget in context
      const currentCampaign = ctx.campaigns?.find(c => c.id === action.campaignId);
      const currentBudget = currentCampaign?.daily_budget ? parseInt(currentCampaign.daily_budget) : null;

      if (currentBudget !== null && !checkBudgetGuardrail(currentBudget, action.dailyBudget)) {
        const variation = Math.abs(action.dailyBudget - currentBudget) / currentBudget;
        return `Guardrail bloqueou: variação de ${(variation * 100).toFixed(0)}% excede limite de 20%.`;
      }

      await trafficService.updateCampaignBudget(action.campaignId, action.dailyBudget, ctx.workspace);
      result = `Orçamento da campanha ${action.campaignId} atualizado para ${action.dailyBudget} centavos/dia.`;

    } else if (action.action === 'pause_adset' && action.adSetId) {
      await trafficService.pauseAdSet(action.adSetId, ctx.workspace);
      result = `Conjunto de anúncios ${action.adSetId} pausado.`;

    } else if (action.action === 'enable_adset' && action.adSetId) {
      await trafficService.enableAdSet(action.adSetId, ctx.workspace);
      result = `Conjunto de anúncios ${action.adSetId} ativado.`;

    } else if (action.action === 'update_adset_budget' && action.adSetId && action.dailyBudget) {
      await trafficService.updateAdSetBudget(action.adSetId, action.dailyBudget, ctx.workspace);
      result = `Orçamento do conjunto ${action.adSetId} atualizado para ${action.dailyBudget} centavos/dia.`;

    } else if (action.action === 'pause_ad' && action.adId) {
      await trafficService.pauseAd(action.adId, ctx.workspace);
      result = `Anúncio ${action.adId} pausado.`;

    } else if (action.action === 'enable_ad' && action.adId) {
      await trafficService.enableAd(action.adId, ctx.workspace);
      result = `Anúncio ${action.adId} ativado.`;

    } else if (action.action === 'update_ad_creative' && action.adId && action.pageId && action.link && action.imageUrl) {
      const creative = await trafficService.createAdCreative(
        ctx.accountId, `Criativo Atualizado ${Date.now()}`, action.pageId, undefined,
        action.link, action.message || '', action.imageUrl, action.callToAction || 'LEARN_MORE', ctx.workspace
      );
      await trafficService.updateAdCreativeId(action.adId, creative.id, ctx.workspace);
      result = `Criativo do anúncio ${action.adId} atualizado com novo texto/imagem.`;

    } else if (action.action === 'create_campaign_complete' && action.name && action.objective) {
      const campaign = await trafficService.createCampaign(
        ctx.accountId, action.name, action.objective, 'PAUSED', ['NONE'], ctx.workspace
      );
      const adSet = await trafficService.createAdSet(
        ctx.accountId, campaign.id, action.adSetName || 'Novo Conjunto',
        action.dailyBudget || 1000, action.optimizationGoal || 'LINK_CLICKS',
        action.billingEvent || 'IMPRESSIONS', undefined, 'PAUSED', ctx.workspace
      );

      let creativeId: string | undefined;
      if (action.pageId && action.link && action.imageUrl) {
        const creative = await trafficService.createAdCreative(
          ctx.accountId, `Criativo ${action.adName || '01'}`, action.pageId, undefined,
          action.link, action.message || '', action.imageUrl, action.callToAction || 'LEARN_MORE', ctx.workspace
        );
        creativeId = creative.id;
      }

      if (creativeId) {
        await trafficService.createAd(ctx.accountId, adSet.id, action.adName || 'Novo Anúncio', creativeId, 'PAUSED', ctx.workspace);
        result = `Campanha "${action.name}" criada completa (PAUSADA).`;
      } else {
        result = `Campanha "${action.name}" e Conjunto criados (sem anúncio por falta de dados do criativo).`;
      }

    } else {
      result = `Ação desconhecida ou parâmetros inválidos: ${action.action}`;
    }
  } catch (err: any) {
    result = `ERROR: ${err.message}`;
  }

  // Log to audit table if context provided (Story 8.3)
  if (logContext) {
    try {
      logAtlasAction({
        action: action.action,
        entityType: inferEntityType(action.action),
        entityId: action.campaignId ?? action.adSetId ?? action.adId ?? 'unknown',
        workspaceId: logContext.workspaceId,
        dryRun: false,
        result,
        reason: action.reason,
        triggeredBy: logContext.triggeredBy,
      });
    } catch { /* audit log failure must never block the action */ }
  }

  return result;
}

function inferEntityType(action: string): 'campaign' | 'adset' | 'ad' | 'unknown' {
  if (action.includes('campaign')) return 'campaign';
  if (action.includes('adset')) return 'adset';
  if (action.includes('_ad')) return 'ad';
  return 'unknown';
}

// ─── System Prompt & Context Builder ─────────────────────────────────────────

const ATLAS_SYSTEM_PROMPT = `Você é o Atlas, um gerente de tráfego pago especialista em Meta ADS (Facebook/Instagram Ads).

Você tem acesso completo aos dados de campanhas do usuário e pode executar ações reais na conta de anúncios.

## Suas capacidades:
- Analisar performance de campanhas (CTR, CPC, CPM, ROAS, gasto, impressões, cliques)
- Identificar campanhas com baixo desempenho e sugerir otimizações
- Pausar e ativar campanhas, conjuntos de anúncios (ad sets) e anúncios (ads)
- Atualizar orçamento diário de campanhas e conjuntos de anúncios
- Criar campanhas, conjuntos de anúncios e anúncios do zero
- Alterar textos e links (criativos) de anúncios existentes
- Priorizar ações com base no ROI

## Seu estilo:
- Direto e objetivo, como um gestor experiente
- Sempre baseado em dados reais da conta
- Proativo: se vir um problema, aponte e ofereça solução
- Use português do Brasil

## Formato de resposta com ações:
Quando o usuário pedir para executar uma ação, responda com JSON no exato formato abaixo. Se houver mais de uma ação, retorne apenas a principal ou a primeira, o sistema executará uma por vez.

**Campanhas:**
\`\`\`json
{"action": "pause_campaign", "campaignId": "123", "reason": "CTR abaixo de 0.5%"}
\`\`\`
\`\`\`json
{"action": "enable_campaign", "campaignId": "123", "reason": "Orçamento reabastecido"}
\`\`\`
\`\`\`json
{"action": "update_budget", "campaignId": "123", "dailyBudget": 5000, "reason": "ROAS alto"}
\`\`\`

**Conjuntos de Anúncios (Ad Sets):**
\`\`\`json
{"action": "pause_adset", "adSetId": "123", "reason": "Custo por conversão muito alto"}
\`\`\`
\`\`\`json
{"action": "enable_adset", "adSetId": "123", "reason": "Testando novo público"}
\`\`\`
\`\`\`json
{"action": "update_adset_budget", "adSetId": "123", "dailyBudget": 5000, "reason": "Escalando público validado"}
\`\`\`

**Anúncios (Ads):**
\`\`\`json
{"action": "pause_ad", "adId": "123", "reason": "Fadiga de criativo"}
\`\`\`
\`\`\`json
{"action": "enable_ad", "adId": "123", "reason": "Criativo reativado para teste"}
\`\`\`
\`\`\`json
{"action": "update_ad_creative", "adId": "123", "pageId": "123", "link": "https://...", "message": "Novo texto", "imageUrl": "https://...", "callToAction": "LEARN_MORE", "reason": "Atualizando copy"}
\`\`\`

**Criação:**
\`\`\`json
{"action": "create_campaign_complete", "name": "Nova Campanha", "objective": "OUTCOME_TRAFFIC", "dailyBudget": 5000, "adSetName": "Público Aberto", "optimizationGoal": "LINK_CLICKS", "billingEvent": "IMPRESSIONS", "adName": "Anúncio 01", "pageId": "123", "link": "https://...", "message": "Texto do anúncio", "imageUrl": "https://...", "callToAction": "LEARN_MORE"}
\`\`\`

**Se nenhuma ação for solicitada:**
\`\`\`json
{"action": "none"}
\`\`\`

Sempre explique o raciocínio antes do JSON de ação.`;

function buildContextSummary(ctx: AtlasContext): string {
  if (!ctx.insights || !ctx.campaigns) return 'Dados de campanha não carregados ainda.';

  const currency = ctx.currency ?? 'BRL';
  const fmt = (v: number) =>
    currency === 'BRL'
      ? `R$ ${v.toFixed(2)}`
      : `$ ${v.toFixed(2)}`;

  const lines: string[] = [
    `## Dados da Conta (${ctx.datePreset ?? 'last_30d'})`,
    `- Gasto total: ${fmt(ctx.insights.total_spend)}`,
    `- Impressões: ${ctx.insights.total_impressions.toLocaleString('pt-BR')}`,
    `- Cliques: ${ctx.insights.total_clicks.toLocaleString('pt-BR')}`,
    `- CTR médio: ${ctx.insights.avg_ctr.toFixed(2)}%`,
    `- CPM médio: ${fmt(ctx.insights.avg_cpm)}`,
    `- CPC médio: ${fmt(ctx.insights.avg_cpc)}`,
    `- ROAS médio: ${ctx.insights.avg_roas.toFixed(2)}x`,
    '',
    `## Campanhas (${ctx.campaigns.length} total)`,
  ];

  for (const c of ctx.campaigns) {
    const ci = ctx.insights.campaigns.find((i) => i.campaign_id === c.id);
    lines.push(
      `- [${c.status}] ${c.name} (ID: ${c.id})` +
      (ci
        ? ` | Gasto: ${fmt(ci.spend)} | CTR: ${ci.ctr.toFixed(2)}% | CPC: ${fmt(ci.cpc)}` +
        (ci.roas ? ` | ROAS: ${ci.roas.toFixed(2)}x` : '')
        : ' | sem dados de insight')
    );

    if ((c as any).adsets?.length > 0) {
      for (const as of (c as any).adsets) {
        lines.push(`  ↳ [AdSet: ${as.status}] ${as.name} (ID: ${as.id}) | Orçamento: ${as.daily_budget ? fmt(parseInt(as.daily_budget) / 100) + '/dia' : 'N/A'}`);
        if (as.ads?.length > 0) {
          for (const ad of as.ads) {
            lines.push(`    ↳ [Ad: ${ad.status}] ${ad.name} (ID: ${ad.id})`);
          }
        }
      }
    }
  }

  return lines.join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function atlasChat(
  userMessage: string,
  history: ChatMessage[],
  ctx: AtlasContext,
  trafficService: TrafficService,
  dryRun?: boolean
): Promise<{ reply: string; actionExecuted?: string }> {
  const contextSummary = buildContextSummary(ctx);

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `${ATLAS_SYSTEM_PROMPT}\n\n${contextSummary}`,
    },
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    temperature: 0.4,
    max_tokens: 1024,
  });

  const reply = completion.choices[0]?.message?.content ?? 'Não consegui processar sua solicitação.';

  const action = extractAction(reply);
  let actionExecuted: string | undefined;

  if (action && action.action !== 'none') {
    actionExecuted = await executeAction(action, ctx, trafficService, {
      dryRun,
      logContext: { workspaceId: ctx.workspace, triggeredBy: 'chat' },
    });
  }

  return { reply, actionExecuted };
}

export async function atlasAutoAnalyze(
  ctx: AtlasContext,
  _trafficService: TrafficService
): Promise<string> {
  if (!ctx.insights || !ctx.campaigns) return 'Sem dados para analisar.';

  const contextSummary = buildContextSummary(ctx);

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: ATLAS_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `${contextSummary}\n\nFaça uma análise completa desta conta de anúncios. Identifique:\n1. Campanhas com melhor e pior performance\n2. Problemas críticos que precisam de atenção imediata\n3. Oportunidades de otimização\n4. Recomendações de ação prioritárias\n\nSeja direto e baseado nos números.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  return completion.choices[0]?.message?.content ?? 'Não foi possível gerar análise.';
}

export async function atlasSchedulerRun(
  ctx: AtlasContext,
  trafficService: TrafficService,
  dryRun = true
): Promise<{ actionsExecuted: ActionResult[]; analysis: string }> {
  const analysis = await atlasAutoAnalyze(ctx, trafficService);
  const actions = extractAllActions(analysis);

  const actionsExecuted: ActionResult[] = [];

  for (const action of actions.slice(0, 5)) {
    if (!action.action || action.action === 'none') continue;

    const entityId = action.campaignId ?? action.adSetId ?? action.adId ?? 'unknown';
    const result = await executeAction(action, ctx, trafficService, {
      dryRun,
      logContext: { workspaceId: ctx.workspace, triggeredBy: 'scheduler' },
    });

    actionsExecuted.push({ action: action.action, entityId, result, dryRun });
  }

  return { actionsExecuted, analysis };
}
