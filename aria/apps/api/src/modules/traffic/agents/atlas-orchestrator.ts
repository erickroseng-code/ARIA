import Groq from 'groq-sdk';
import { TrafficService, AccountInsights, Campaign } from '../traffic.service';
import { logAtlasAction } from './atlas-audit';

let _groqClient: Groq | null = null;
function getGroqClient() {
  if (!_groqClient) {
    _groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy_to_prevent_crash' });
  }
  return _groqClient;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AtlasContext {
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
  entityName?: string;
  reason?: string;
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
Você opera em modo SEMI-AUTÔNOMO: analisa, diagnostica e PROPÕE ações, mas NUNCA executa sem aprovação explícita do operador via Telegram.

## Suas capacidades:
- Analisar performance de campanhas (CTR, CPC, CPM, ROAS, CPA, gasto, impressões, cliques)
- Diagnosticar problemas por camadas: Conta → Campanha → Conjunto → Anúncio
- Identificar fadiga de criativo, problemas de destino e pressão de leilão
- Propor otimizações com justificativa baseada em dados
- Pausar e ativar campanhas, conjuntos de anúncios (ad sets) e anúncios (ads) — APENAS APÓS APROVAÇÃO
- Atualizar orçamento diário — APENAS APÓS APROVAÇÃO
- Criar campanhas, conjuntos de anúncios e anúncios do zero — APENAS APÓS APROVAÇÃO
- Alterar textos e criativos de anúncios existentes — APENAS APÓS APROVAÇÃO

## Seu estilo:
- Direto e objetivo, como um gestor experiente
- Sempre baseado em dados reais da conta
- Proativo: se vir um problema, aponte a causa raiz com base nas métricas de diagnóstico
- Use português do Brasil

---

## REGRAS FUNDAMENTAIS DE ANÁLISE

### 1. FLUXO OBRIGATÓRIO — Proposta antes de Ação
Você NUNCA executa ações diretamente. O fluxo é:
1. Analise os dados → identifique as ações recomendadas
2. PROPONHA as ações com detalhes e justificativa (via JSON de proposta)
3. Aguarde aprovação do operador no Telegram
4. Somente após aprovação a ação é executada

### 2. Hierarquia de Análise em Camadas
Analise sempre de cima para baixo — NUNCA salte níveis:
- Nível 1 — Campanha: CPA/ROAS global está dentro da meta?
- Nível 2 — Conjunto de Anúncios: qual público está puxando a média para baixo?
- Nível 3 — Anúncio (Micro): há um criativo individual "perdedor" causando o problema?

### 3. Regra de Amostragem Mínima
PROIBIDO pausar ou alterar qualquer ativo antes de:
- Mínimo 800 a 1.000 impressões por ativo
- Mínimo 24 a 48 horas de veiculação
- Exceção: stop-loss quando o gasto > 3× o CAC alvo sem nenhuma conversão

### 4. Matriz de Métricas: Primárias vs. Diagnóstico

**Métricas Primárias (o que importa):** CPA, ROAS e Conversões

**Métricas de Diagnóstico (onde está o erro):**
- CTR Baixo → Problema no Criativo (não parou o scroll ou não gerou desejo)
- CTR Alto + CVR Baixa → Problema no Destino (página lenta, checkout complexo, oferta desalinhada)
- CPC/CPM Alto → Alta concorrência no público OU baixa relevância no leilão
- CPC↑ + CTR↓ simultaneamente → Fadiga de criativo confirmada (NÃO é leilão mais caro)

### 5. Protocolo "Salvar antes de Pausar" (Regra Crítica)
Se um Conjunto de Anúncios tiver CPA acima da meta:
- Primeiro: abra o conjunto e analise os anúncios individualmente
- Se houver criativo com performance aceitável + outro muito ruim → Pause APENAS o anúncio ruim
- Pausar o conjunto INTEIRO é o ÚLTIMO recurso
- Razão: forçar orçamento para o criativo bom preserva o aprendizado do público

### 6. Regra de Isolamento de Variáveis
Ao recomendar testes ou novos criativos:
- Mude apenas UMA variável por vez (copy OU hook — nunca ambos)
- Documente claramente qual variável foi alterada

---

## THRESHOLDS DE DECISÃO

| Métrica | Condição | Ação |
|---------|----------|------|
| CPA | > 1,5× meta por 3 dias consecutivos | Propor pausa do ativo |
| CPA | < meta (ex: < R$7,00) | Propor escalonamento progressivo |
| CTR | < 1,5% | Sinalizar: CPM fica mais caro por irrelevância |
| CTR | Queda > 30% vs. média histórica | Sinalizar fadiga — propor trocar criativo |
| Hook Rate (3s) | < 20% | Recomendar troca dos primeiros 3 segundos do vídeo |
| Hook Rate (3s) | 20% – 25% | Monitorar |
| Hold Rate (ThruPlays/3s) | < 40% | Problema no corpo do vídeo/oferta (não no gancho) |
| ROAS (7 dias) | > 1,2× meta + ≥15 conv. semanais | Aumentar orçamento 15-20% |
| ROAS (7 dias) | < 1,0 | Reduzir orçamento imediatamente |
| Frequência (público frio) | > 3,0 | Monitorar CTR↓ e CPA↑ — sinal de rotacionar criativo |
| Budget Scaling | Qualquer aumento | MÁXIMO 20% a cada 48-72h (aumentos maiores resetam aprendizado) |
| Stop-Loss (novo anúncio) | Gasto > 3× CAC alvo sem conversão | Propor pausa imediata |
| Iniciação de Checkout (IC) | Custo > 10% do valor do produto + sem vendas | Propor pausa do conjunto |

---

## GUARDRAILS — O QUE NUNCA FAZER

- ❌ Aumentar budget > 20% de uma vez (reseta aprendizado)
- ❌ Pausar ativo com < 800 impressões (amostragem insuficiente)
- ❌ Tomar decisão apenas pelo nível de campanha sem verificar adsets/ads
- ❌ Mudar mais de uma variável num teste (impossibilita diagnóstico)
- ❌ Executar ação sem aprovação via Telegram
- ❌ Pausar conjunto completo sem antes verificar anúncios individuais

## Formato de resposta com ações:
Quando o usuário pedir para executar uma ação via chat, responda com JSON no exato formato abaixo. Na análise autônoma diária (quando solicitado a fazer análise em passos), emita TODOS os JSONs de proposta identificados (até o limite especificado no pedido).

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
            const adI = (ctx as any).adInsights?.find((i: any) => i.ad_id === ad.id);
            const adStats = adI
              ? ` | CTR: ${adI.ctr.toFixed(2)}% | Gasto: ${fmt(adI.spend)} | Impressões: ${adI.impressions.toLocaleString('pt-BR')}${adI.ctr < 1 ? ' ⚠️ CTR BAIXO' : ''}`
              : '';
            lines.push(`    ↳ [Ad: ${ad.status}] ${ad.name} (ID: ${ad.id})${adStats}`);
          }
        }
      }
    }
  }

  // Ad-level insights section — shown whenever adInsights are available,
  // regardless of whether the campaign hierarchy includes adsets/ads.
  const adInsights: any[] = (ctx as any).adInsights ?? [];
  if (adInsights.length > 0) {
    lines.push('', `## Insights por Anúncio — nível ad (last_7d)`);
    for (const ad of adInsights) {
      const flags: string[] = [];
      if (ad.impressions >= 800 && ad.ctr < 1.5) flags.push('⚠️ CTR BAIXO');
      if (ad.impressions >= 800 && ad.ctr < 1.0) flags.push('🔴 POSSÍVEL FADIGA');
      lines.push(
        `- ${ad.ad_name} (ID: ${ad.ad_id})` +
        ` | CTR: ${ad.ctr.toFixed(2)}%` +
        ` | CPC: ${fmt(ad.cpc)}` +
        ` | Gasto: ${fmt(ad.spend)}` +
        ` | Impressões: ${ad.impressions.toLocaleString('pt-BR')}` +
        (flags.length > 0 ? ` ${flags.join(' ')}` : '')
      );
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

  const completion = await getGroqClient().chat.completions.create({
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

  const completion = await getGroqClient().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: ATLAS_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `${contextSummary}

Realize a análise diária autônoma desta conta. Siga OBRIGATORIAMENTE a seguinte estrutura:

## PASSO 1 — Verificação de Amostragem
- Identifique quais ativos têm < 800 impressões ou < 24h de veiculação
- EXCLUA esses ativos de qualquer decisão de otimização

## PASSO 2 — Análise por Camadas (Nível Campanha)
- Para cada campanha: CPA e ROAS estão dentro da meta?
- Identifique as campanhas com MELHOR e PIOR performance
- Se CPA > 1,5× a meta por 3 dias consecutivos → marque para investigação

## PASSO 3 — Análise por Camadas (Nível Conjunto de Anúncios)
- Para cada campanha problemática: qual conjunto está puxando a média para baixo?
- Verifique frequência: se > 3,0 em público frio, sinalizar

## PASSO 4 — Protocolo "Salvar antes de Pausar" (Nível Anúncio)
- Para cada conjunto problemático: abra e analise os anúncios individualmente
- Use as métricas de diagnóstico:
  * CTR < 1,5% → problema de criativo
  * CTR alto + CVR baixa → problema de destino
  * CPC↑ + CTR↓ → fadiga de criativo confirmada
  * Hook Rate < 20% → problema nos primeiros 3 segundos
  * Hold Rate < 40% → problema no corpo do vídeo
- Se houver criativo bom + criativo ruim no mesmo conjunto → PAUSE APENAS o ruim

## PASSO 5 — Oportunidades de Escalonamento
- ROAS (7 dias) > 1,2× meta com ≥ 15 conversões semanais → candidato a aumento de budget
- Se aumentar: máximo 15-20% a cada 48-72h

## PASSO 6 — Stop-Loss
- Qualquer anúncio novo com gasto > 3× o CAC alvo sem conversões → propor pausa imediata
- Conjunto com custo de Iniciação de Checkout > 10% do valor do produto sem vendas → propor pausa

## PASSO 7 — Emita as PROPOSTAS
Para cada ação identificada, emita um JSON de proposta no formato padronizado.
LEMBRE-SE: você PROPÕE, não executa. O operador aprova via Telegram.
Limite máximo: 5 propostas por ciclo. Priorize na ordem: stop-loss > fadiga criativa > escalonamento.
Ao recomendar testes: mudança de UMA variável por vez.

Seja direto e baseado exclusivamente nos números. Se não houver dados suficientes, diga claramente.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  return completion.choices[0]?.message?.content ?? 'Não foi possível gerar análise.';
}

function findEntityName(action: Record<string, any>, ctx: AtlasContext): string | undefined {
  const campaigns = ctx.campaigns ?? [];
  if (action.campaignId) {
    return campaigns.find(c => c.id === action.campaignId)?.name;
  }
  if (action.adSetId) {
    for (const campaign of campaigns) {
      const adset = ((campaign as any).adsets ?? []).find((a: any) => a.id === action.adSetId);
      if (adset) return adset.name;
    }
  }
  if (action.adId) {
    for (const campaign of campaigns) {
      for (const adset of ((campaign as any).adsets ?? [])) {
        const ad = (adset.ads ?? []).find((a: any) => a.id === action.adId);
        if (ad) return ad.name;
      }
    }
  }
  return undefined;
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
    const entityName = findEntityName(action, ctx);
    const result = await executeAction(action, ctx, trafficService, {
      dryRun,
      logContext: { workspaceId: ctx.workspace, triggeredBy: 'scheduler' },
    });

    actionsExecuted.push({ action: action.action, entityId, entityName, reason: action.reason, result, dryRun });
  }

  return { actionsExecuted, analysis };
}

// ─── Telegram Bot Exports ─────────────────────────────────────────────────────

export async function executeAtlasAction(
  action: Record<string, any>,
  ctx: AtlasContext,
  trafficService: TrafficService,
  dryRun = false,
): Promise<string> {
  return executeAction(action, ctx, trafficService, { dryRun });
}

const PROPOSAL_LABELS: Record<string, string> = {
  pause_campaign: '⏸ Pausar campanha',
  enable_campaign: '▶️ Ativar campanha',
  update_budget: '💰 Atualizar budget da campanha',
  pause_adset: '⏸ Pausar adset',
  enable_adset: '▶️ Ativar adset',
  update_adset_budget: '💰 Escalar budget do adset',
  pause_ad: '⏸ Pausar anúncio',
  enable_ad: '▶️ Ativar anúncio',
};

export interface ProposedAction {
  action: Record<string, any>;
  label: string;
  entityName?: string;
}

export async function atlasGetProposedActions(
  ctx: AtlasContext,
  trafficService: TrafficService,
): Promise<{ analysis: string; proposals: ProposedAction[] }> {
  const analysis = await atlasAutoAnalyze(ctx, trafficService);
  const rawActions = extractAllActions(analysis);

  const proposals: ProposedAction[] = rawActions
    .filter(a => a.action && a.action !== 'none')
    .slice(0, 8)
    .map(action => ({
      action,
      label: PROPOSAL_LABELS[action.action] ?? `⚙️ ${action.action}`,
      entityName: findEntityName(action, ctx),
    }));

  return { analysis, proposals };
}
