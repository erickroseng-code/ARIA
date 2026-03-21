/**
 * Maverick Copywriter — autocontido para produção (ARIA Docker)
 * Gera roteiros com brain/ principles + staged generation (hook → técnicas → corpo)
 */
import fs from 'fs';
import path from 'path';
import { TrendResearch } from './trend-researcher.service';

const BRAIN_DIR = path.join(__dirname, 'brain');

// ─── Brain loader ─────────────────────────────────────────────────────────────

interface Brain {
  hooks: string;        // técnicas de gancho: qual escolher e como aplicar
  storytelling: string; // princípios narrativos para o corpo
  persuasion: string;   // gatilhos de persuasão a inserir em momentos específicos
  audience: string;     // quem é a audiência, como ela pensa e que linguagem usa
  virality: string;     // ângulos e mecânicas que maximizam compartilhamento
  closing: string;      // técnicas de CTA e fechamento
  constraints: string;  // restrições de estilo e veto de palavras
}

// Extrai "Exemplo bom" de cada técnica do hooks.md para uso como referência direta
function extractHookExamples(hooksContent: string): string {
  const examples: string[] = [];
  const techniqueBlocks = hooksContent.split(/^## /m).slice(1); // cada bloco começa com "## NOME"
  for (const block of techniqueBlocks) {
    const nameMatch = block.match(/^(.+)/);
    const exampleMatch = block.match(/Exemplo bom:\s*(.+?)(?:\nExemplo ruim:|$)/s);
    if (nameMatch && exampleMatch) {
      const name = nameMatch[1].trim();
      const example = exampleMatch[1].trim().replace(/\n/g, ' ');
      examples.push(`• ${name}:\n  ${example}`);
    }
  }
  return examples.join('\n\n');
}

function loadBrain(): Brain {
  const load = (filename: string): string => {
    const p = path.join(BRAIN_DIR, filename);
    if (!fs.existsSync(p)) {
      console.warn(`[BRAIN] arquivo não encontrado: ${p}`);
      return '';
    }
    try {
      const content = fs.readFileSync(p, 'utf-8').replace(/^---[\s\S]*?---\n/, '').trim();
      console.log(`[BRAIN] carregado: ${filename} (${content.length} chars)`);
      return content;
    } catch (err) {
      console.error(`[BRAIN] erro ao ler ${filename}:`, err);
      return '';
    }
  };

  const brain: Brain = {
    hooks:        load('hooks.md'),
    storytelling: load('storytelling.md'),
    persuasion:   load('persuasion.md'),
    audience:     load('audience.md'),
    virality:     load('virality.md'),
    closing:      load('closing.md'),
    constraints:  load('constraints.md'),
  };

  const total = Object.values(brain).reduce((s, v) => s + v.length, 0);
  console.log(`[BRAIN] total carregado: ${total} chars (7 arquivos)`);
  return brain;
}

// ─── LLM helper ───────────────────────────────────────────────────────────────

async function llmChat(prompt: string, system?: string, modelPriority?: string[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY não configurada');

  const messages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    { role: 'user', content: prompt },
  ];

  // Modelos ordenados por custo-benefício para copywriting em português
  const models = modelPriority || ['meta-llama/llama-4-maverick', 'google/gemini-2.0-flash-001', 'deepseek/deepseek-v3.2'];
  for (const model of models) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://aria-api.onrender.com',
        },
        body: JSON.stringify({ model, messages, temperature: 0.92 }),
      });
      const data = await res.json() as any;
      const content = data?.choices?.[0]?.message?.content;
      if (content) return content;
    } catch (e) {
      console.log(`[LLM] ${model} falhou, tentando próximo...`);
    }
  }
  throw new Error('Todos os modelos falharam');
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TechniquePlan {
  audience_awareness_level: 'Frio' | 'Morno' | 'Quente';
  dominant_behavioral_profile: 'Verde' | 'Azul' | 'Vermelho' | 'Ouro';
  hook_technique: string;
  storytelling: string;
  persuasion: string;
  virality: string;
  closing: string;
}

export interface StrategySetup {
  audience_awareness_level: string;
  dominant_behavioral_profile: string;
  hook_technique: string;
  storytelling_technique: string;
  persuasion_technique: string;
  virality_technique: string;
  closing_technique: string;
}

export interface GeneratedScript {
  title: string;
  hook: string;
  body: string;
  cta: string;
  framework: string;
  funnel_stage: string;
  hook_technique?: string;
  technique_plan?: TechniquePlan;
  strategy_setup?: StrategySetup;
}

// ─── Merge Niche with Brain ───────────────────────────────────────────────────

/**
 * Mescla as informações do nicho/usuário com as referências do brain.
 */
async function mergeNicheWithBrain(
  userProfile: string,
  brain: Brain,
  trendResearch?: TrendResearch,
  onStep?: (msg: string) => void,
): Promise<string> {
  onStep?.('🔗 Mesclando nicho com referências do brain...');

  let extraContext = '';
  if (trendResearch?.insights?.length) {
    extraContext = `\n━━━ TENDÊNCIAS VIRAIS ATUAIS ━━━\nO que está funcionando no nicho agora:\n${trendResearch.insights.map((i: any) => `- Padrão: ${i.hook_pattern}\n  Ângulo: ${i.angle}\n  Princípio: ${i.engagement_signal}\n  Exemplo Real: "${i.example_hook}"`).join('\n')}\n`;
  }

  const mergePrompt = `Você é um estrategista de conteúdo clínico. Analise o perfil abaixo e combine com os frameworks de copywriting disponíveis.

PERFIL DO NICHO/USUÁRIO:
${userProfile}

━━━ AUDIÊNCIA — leia e use para calibrar o tom ━━━
${brain.audience}

━━━ VIRALIDADE — use para identificar mecânicas que funcionam neste nicho ━━━
${brain.virality}

━━━ PERSUASÃO — use para mapear as objeções e gatilhos centrais ━━━
${brain.persuasion}
${extraContext}

━━━ RESTRIÇÕES ABSOLUTAS DE TOM (NUNCA VIOLE) ━━━
${brain.constraints}

Retorne um bloco de texto estruturado com EXATAMENTE estas seções:
DORES CENTRAIS: as 3 dores mais agudas e específicas deste nicho (com linguagem que o público usaria — não academizada)
ÂNGULOS PROMISSORES: 3-4 situações reais do dia a dia deste público que geram identificação imediata
TOM DE VOZ: como esta audiência fala, o que a repele, o nível de cinismo em relação a soluções do mercado

Seja clínico e específico. Proibido generalizar. Proibido coach-speak.`;

  return await llmChat(
    mergePrompt,
    'Você é o MAVERICK — Estrategista Clínico de Viralização e Conversão. Direto, sem enfeite, focado em lucro.',
    ['openai/gpt-oss-120b', 'openai/gpt-4.1-mini', 'deepseek/deepseek-v3.2'],
  );
}


// ─── Diagnosis extractor ──────────────────────────────────────────────────────

interface ExtractedDiagnosis {
  audience_profile: string;   // quem é o público com dores e aspirações reais
  diagnosis: string;          // GAP central identificado pelo Strategist
  key_concept: string;        // conceito/framework central do diagnóstico
  product_hint: string;       // o que vende ou deveria vender
  main_pain: string;          // dor principal do público
}

function extractDiagnosis(planJson: string): ExtractedDiagnosis {
  try {
    const parsed = JSON.parse(planJson);
    const strategy = parsed?.strategy ?? {};
    const icp = strategy?.suggested_icp ?? {};

    const audience_profile = [
      icp.inferred_audience,
      icp.main_pain_addressed ? `Dor principal: ${icp.main_pain_addressed}` : '',
      icp.recommended_positioning ?? '',
    ].filter(Boolean).join(' | ') || '';

    return {
      audience_profile,
      diagnosis:    strategy.diagnosis            ?? '',
      key_concept:  strategy.key_concept          ?? '',
      product_hint: icp.inferred_product          ?? '',
      main_pain:    icp.main_pain_addressed        ?? '',
    };
  } catch {
    return { audience_profile: '', diagnosis: '', key_concept: '', product_hint: '', main_pain: '' };
  }
}

// ─── Focused plan builder ─────────────────────────────────────────────────────

/**
 * Extrai só os campos estratégicos do JSON do Strategist.
 * Remove ruído (analysis, profile_score, engagement_panorama, etc.)
 * para que o mergeNicheWithBrain receba um contexto limpo e focado.
 */
function buildFocusedPlan(planJson: string): string {
  try {
    const parsed = JSON.parse(planJson);
    const strategy = parsed?.strategy ?? {};
    const icp = strategy?.suggested_icp ?? {};
    const profile = parsed?.profile ?? {};

    const focused = {
      profile: {
        username: profile.username ?? parsed?.analysis?.username ?? '',
        followers: profile.followers ?? '',
      },
      strategy: {
        diagnosis: strategy.diagnosis ?? '',
        key_concept: strategy.key_concept ?? '',
        suggested_icp: {
          inferred_audience: icp.inferred_audience ?? '',
          inferred_product: icp.inferred_product ?? '',
          main_pain_addressed: icp.main_pain_addressed ?? '',
          recommended_positioning: icp.recommended_positioning ?? '',
        },
        funnel_mix: {
          tofu_pct: strategy.funnel_mix?.tofu_pct ?? 33,
          mofu_pct: strategy.funnel_mix?.mofu_pct ?? 34,
          bofu_pct: strategy.funnel_mix?.bofu_pct ?? 33,
          reasoning: strategy.funnel_mix?.reasoning ?? '',
        },
        next_steps: strategy.next_steps ?? [],
      },
    };

    return JSON.stringify(focused);
  } catch {
    return planJson; // fallback: usa o plan original
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateScriptsFromPlan(
  plan: string,
  trendResearch?: TrendResearch,
  onStep?: (msg: string) => void,
): Promise<GeneratedScript[]> {
  const brain = loadBrain();

  // Reduz ruído do Strategist — extrai só os campos estratégicos relevantes
  const focusedPlan = buildFocusedPlan(plan);
  console.log(`[FOCUSED-PLAN] Plano focado: ${focusedPlan.length} chars (original: ${plan.length} chars)`);

  // Extrai diagnóstico real do plano (dados do Scout + Strategist via Apify)
  const diagnosis = extractDiagnosis(focusedPlan);
  if (diagnosis.audience_profile) {
    console.log(`[DIAGNOSIS] audience_profile extraído: ${diagnosis.audience_profile.slice(0, 120)}`);
  } else {
    console.warn('[DIAGNOSIS] audience_profile vazio — plan pode não ser JSON do Strategist');
  }

  // Mescla o plano do usuário com as referências do brain
  let enrichedContext = '';
  try {
    enrichedContext = await mergeNicheWithBrain(focusedPlan, brain, trendResearch, onStep);
    console.log(`[MERGE] Contexto enriquecido gerado (${enrichedContext.length} chars)`);
  } catch (e) {
    console.warn('[MERGE] Falha no merge, usando plan original:', e);
    enrichedContext = focusedPlan; // fallback para plan focado
  }

  onStep?.('🧠 Selecionando ângulos e frameworks...');

  // ── Pass 1: selecionar ângulos usando diagnóstico real + virality + audience ──
  const diagnosisBlock = diagnosis.audience_profile ? `
━━━ DIAGNÓSTICO REAL DO PERFIL (extraído via Apify + Strategist) ━━━
Público-alvo: ${diagnosis.audience_profile}
${diagnosis.diagnosis ? `Diagnóstico estratégico: ${diagnosis.diagnosis}` : ''}
${diagnosis.key_concept ? `Conceito-chave: ${diagnosis.key_concept}` : ''}
${diagnosis.main_pain ? `Dor principal: ${diagnosis.main_pain}` : ''}
${diagnosis.product_hint ? `Produto/Serviço: ${diagnosis.product_hint}` : ''}
━━━ USE ESSES DADOS REAIS — não invente nem generalize o público ━━━
` : '';

  const ideasRaw = await llmChat(
    `Analise o plano estratégico abaixo e extraia 3-4 ideias de roteiros para Instagram Reels/Carrossel.
${diagnosisBlock}
CALIBRAÇÃO DE AUDIÊNCIA (use para escolher ângulos que falem com ESTE público específico):
${brain.audience}

MECÂNICAS DE VIRALIDADE (use para escolher ângulos com maior potencial de alcance/compartilhamento):
${brain.virality}

Para cada ideia, defina:
- title: título do roteiro
- context: o problema/dor/desejo específico que este roteiro resolve
- framework: PAS | AIDA | BAB | HOOK_STORY_OFFER (qual serve melhor para este ângulo)
- funnel_stage: TOFU | MOFU | BOFU
- virality_angle: qual mecânica de viralidade (Polarização, Ancoragem nos Extremos, High-Arousal, etc.) este ângulo ativa
- audience_profile: descrição CONCRETA do público (baseie-se no DIAGNÓSTICO REAL acima, não invente)

REGRA DE PREMISSA (OBRIGATÓRIO): Cada um dos roteiros DEVE ter uma premissa diferente das abaixo:
1. "O Erro Fatal": focado em algo que o público está fazendo errado e não percebeu.
2. "O Bastidor Clínico": focado em um dado, número ou situação real de quem opera no nicho.
3. "A Visão de Futuro/Contraste": focado em como o mercado está mudando e quem vai ficar para trás.
4. "O Mecanismo Único": focado em um método ou detalhe técnico que ninguém comenta.

PROIBIDO: Começar o contexto ou o título de dois roteiros pela mesma palavra. Diversidade temática é prioridade máxima.

CONTEXTO ESTRATÉGICO (mesclado com brain):
${enrichedContext}

RESTRIÇÕES DE TOM E ESTILO (PRIORIDADE MÁXIMA — ângulos que violarem serão descartados):
${brain.constraints}

REGRA DE DISTINÇÃO: Cada ângulo deve explorar uma dor ou desejo DIFERENTE do nicho. Sem repetir tema, estrutura ou abordagem.

REGRA DE FUNIL OBRIGATÓRIA:
- Se gerar 3 ângulos: 1 TOFU + 1 MOFU + 1 BOFU
- Se gerar 4 ângulos: 2 TOFU + 1 MOFU + 1 BOFU
O campo funnel_stage deve refletir isso — não coloque TOFU em todos.

Retorne APENAS JSON array:
[{"title":"...","context":"...","framework":"PAS","funnel_stage":"TOFU","virality_angle":"...","audience_profile":"..."}]`,
    'Você é o MAVERICK — Estrategista Clínico de Viralização e Conversão. Direto, sem enfeite, focado em lucro. Não é assistente virtual. Retorne APENAS JSON válido.'
  );

  let ideas: Array<{
    title: string;
    context: string;
    framework: string;
    funnel_stage: string;
    virality_angle?: string;
    audience_profile?: string;
  }> = [];

  try {
    const match = ideasRaw.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(match?.[0] ?? '[]');
    // Normaliza campos — LLM às vezes retorna nomes diferentes
    ideas = parsed.map((item: any) => ({
      title:          item.title        ?? item.titulo      ?? item.idea_title  ?? item.roteiro ?? 'Roteiro sem título',
      context:        item.context      ?? item.contexto    ?? item.dor         ?? item.problema ?? '',
      framework:      item.framework    ?? item.tipo        ?? item.estrutura   ?? 'PAS',
      funnel_stage:   item.funnel_stage ?? item.funil       ?? item.etapa       ?? 'TOFU',
      virality_angle: item.virality_angle ?? item.viralidade ?? item.angulo_viral ?? '',
      audience_profile: item.audience_profile ?? item.audiencia ?? item.perfil_audiencia ?? '',
    }));
    console.log(`[PASS1] ${ideas.length} ângulos gerados:`, ideas.map((i: any) => i.title));
  } catch {
    console.warn('[PASS1] Parse falhou, usando fallback de 1 ideia');
    ideas = [{ title: plan.slice(0, 80), context: plan.slice(0, 200), framework: 'PAS', funnel_stage: 'TOFU' }];
  }

  onStep?.('🎣 Gerando hooks com técnicas do brain...');

  // ── Pass 2: gerar cada roteiro sequencialmente para forçar diversidade ──────
  const usedHookTechniques: string[] = [];
  const usedBodyTechniques: string[] = [];
  const generatedHooksContext: string[] = [];

  const scripts: GeneratedScript[] = [];
  for (const idea of ideas) {

    // ── Pass 2a: hook isolado — usa técnica como PRINCÍPIO, cria algo ORIGINAL ─
    const hookExamples = extractHookExamples(brain.hooks);
    const hookRaw = await llmChat(
      `Você receberá um briefing de roteiro e o catálogo de técnicas de hook.
Sua tarefa: escolher a técnica mais adequada e escrever um hook 100% ORIGINAL para o briefing.

BRIEFING:
- Título: ${idea.title}
- Contexto/Dor: ${idea.context}
- Framework: ${idea.framework}
- Funil: ${idea.funnel_stage}
- Mecânica viral alvo: ${idea.virality_angle || 'escolha a mais adequada'}
- Perfil de audiência: ${idea.audience_profile || diagnosis.audience_profile || 'empreendedores/gestores brasileiros'}

━━━ REFERÊNCIA DE NÍVEL — apenas para calibrar qualidade, NUNCA para copiar ou adaptar ━━━
${hookExamples}

${usedHookTechniques.length > 0 ? `⛔ TÉCNICAS JÁ USADAS NESTE BATCH — PROIBIDO reutilizar:
${usedHookTechniques.map(t => `- ${t}`).join('\n')}
Escolha obrigatoriamente uma técnica DIFERENTE.

` : ''}${generatedHooksContext.length > 0 ? `⛔ HOOKS JÁ GERADOS NESTA SESSÃO — PROIBIDO TER ESTRUTURA SINTÁTICA PARECIDA:
${generatedHooksContext.map(h => `- "${h}"`).join('\n')}
REGRA ABSOLUTA: O seu novo hook DEVE começar com uma classe gramatical diferente e abordar o problema por um ângulo novo. Evite o loop de mesma estrutura!

` : ''}━━━ CATÁLOGO DE TÉCNICAS DE HOOK ━━━
${brain.hooks}

━━━ REGRAS ESTRITAS DE ABERTURA (HOOK) ━━━
1. Escolha UMA técnica do catálogo e aplique de forma INVISÍVEL
2. O hook DEVE ser 100% original e focado na dor real do nicho, usando números ou situações tangíveis
3. PROIBIDO começar a frase com "Você..." (ex: "Você está", "Você já", "Você sabia")
4. PROIBIDO começar com "Se..." (ex: "Se você quer", "Se você ainda não")
5. PROIBIDO começar com perguntas (ex: "Como fazer...?", "E se...?")
6. A PRIMEIRA PALAVRA deve ser de impacto: um dado, um substantivo forte, uma afirmação clínica ou uma reação.
7. O tom deve ser "Penoni Mode": direto, assertivo, sem enrolação. NUNCA soe como coach ou anúncio barato.

Retorne APENAS JSON:
{"hook":"texto do hook começando de forma visceral e sem pronomes ou condicionais","hook_technique":"nome exato da técnica usada","formula_applied":"como a fórmula foi aplicada aqui (1 frase)"}`,
      'Você é o MAVERICK — Estrategista Clínico de Viralização e Conversão. Retorne APENAS JSON válido.',
      ['openai/gpt-4o-mini', 'openai/gpt-4.1-mini', 'deepseek/deepseek-v3.2'],
    );

    let hookData: { hook: string; hook_technique: string; formula_applied?: string } = { hook: '', hook_technique: '' };
    try {
      const match = hookRaw.match(/\{[\s\S]*\}/);
      hookData = JSON.parse(match?.[0] ?? '{}');
    } catch { /* usa fallback abaixo */ }

    // ── Hook Judge: valida e regenera até 2x se o hook for ruim ─────────────
    const HOOK_ANTI_PATTERNS = [
      /^[\s"'\«\»]*se\s+você/i,           // "Se você..."
      /^[\s"'\«\»]*você\s+(está|já|quer|sabe|tem|ainda|também|precisa|vai)/i, // "Você [verbo]..."
      /^[\s"'\«\»]*e\s+se\s+você/i,      // "E se você..."
      /^[\s"'\«\»]*será\s+que/i,         // "Será que..."
      /^[\s"'\«\»]*imagina\s+(se|você)/i, // "Imagina se..."
      /o\s+problema\s+é\s+(isso|esse)/i, // "o problema é isso"
      /é\s+isso\s+(mesmo|aqui|que)/i,    // "é isso mesmo"
      /^[\s"'""«»]*como\s+fazer/i,         // "Como fazer..." — genérico
      /^[\s"'""«»]*[0-9]+\s+(dicas|estratégias|passos|segredos)/i, // "5 dicas para..." — genérico
      /o\s+segredo\s+(é|está|que)/i,     // "o segredo é/está" — proibido
      /você\s+sabia/i,          // "Você sabia que..." — proibido
      /descubra\s+(como|o|a)/i, // "Descubra como..." — proibido
    ];

    const isHookBad = (h: string): boolean => HOOK_ANTI_PATTERNS.some(p => p.test(h.trim()));

    let judgeAttempts = 0;
    while (hookData.hook && isHookBad(hookData.hook) && judgeAttempts < 2) {
      judgeAttempts++;
      console.log(`[HOOK-JUDGE] Hook reprovado (tentativa ${judgeAttempts}): "${hookData.hook.slice(0, 60)}"`);
      onStep?.(`🔄 Hook reprovado pelo juiz — regenerando (${judgeAttempts}/2)...`);

      const retryRaw = await llmChat(
        `O hook abaixo foi REPROVADO automaticamente porque começa com padrão proibido:
HOOK REPROVADO: "${hookData.hook}"

❌ PADRÃO IDENTIFICADO: o hook começa com palavra proibida (Se você / Você já / E se / Será que / Como fazer / etc.)

TAREFA: Escreva um hook COMPLETAMENTE DIFERENTE. A primeira palavra do hook NÃO PODE SER nenhuma dessas:
→ "Se", "Você", "E", "Será", "Imagina", "Como", "O segredo", "Descubra"

BRIEFING:
- Título: ${idea.title}
- Contexto/Dor: ${idea.context}
- Framework: ${idea.framework}
- Funil: ${idea.funnel_stage}

COMO DEVE COMEÇAR — opções válidas:
• Com um FATO concreto: "R$ 12.000 em tráfego pago. Zero retorno."
• Com uma REAÇÃO crua: "Eu vejo perfil desse e fico com dó."
• Com uma CENA específica: "Segunda-feira, 7h da manhã. Inbox vazio."
• Com um NÚMERO chocante: "Três meses. Todo dia. 90 posts. 4 clientes."
• Com uma OBSERVAÇÃO de bastidores: "O que os grandes criadores fazem diferente..."
• Com uma DECLARAÇÃO forte: "Postar sem estratégia é trabalhar de graça."

REGRAS ABSOLUTAS:
1. A PRIMEIRA PALAVRA do hook NÃO pode ser: Se, Você, E (se), Será, Imagina, Como, Descubra
2. Mencione algo concreto ao nicho: cargo, situação real, dado específico
3. Soe como pessoa real falando para outra — não coach, não anúncio
4. Máximo 25 palavras

Retorne APENAS JSON:
{"hook":"hook que começa com fato, reação ou cena — nunca com Se/Você","hook_technique":"técnica usada","formula_applied":"como aplicou"}`,
        'Você é o MAVERICK — Estrategista Clínico de Viralização e Conversão. Retorne APENAS JSON válido.',
        ['openai/gpt-4o-mini', 'openai/gpt-4.1-mini', 'deepseek/deepseek-v3.2'],
      );

      try {
        const m = retryRaw.match(/\{[\s\S]*\}/);
        const retried = JSON.parse(m?.[0] ?? '{}');
        if (retried.hook) hookData = retried;
      } catch { /* mantém o anterior */ }
    }

    if (judgeAttempts > 0) {
      const stillBad = isHookBad(hookData.hook ?? '');
      console.log(`[HOOK-JUDGE] Hook ${stillBad ? 'ainda ruim após retries' : 'aprovado após ' + judgeAttempts + ' tentativa(s)'}: "${hookData.hook?.slice(0, 60)}"`);

      // Fallback de emergência: se ainda ruim após 2 retries, force reescrita via prompt ultra-restritivo
      if (stillBad && hookData.hook) {
        console.log(`[HOOK-JUDGE] Aplicando fallback de emergência — reescrita forçada`);
        try {
          const emergencyRaw = await llmChat(
            `TAREFA ÚNICA: Reescreva o início deste hook para que NÃO comece com "Se", "Você", "E se", "Será", "Imagina", "Como" ou "Descubra".

HOOK ORIGINAL (início proibido): "${hookData.hook}"

INSTRUÇÃO: Remova as primeiras palavras até a primeira vírgula ou ponto final, depois continue o hook a partir daí. Se não houver vírgula, inverta a estrutura da frase para que o fato concreto venha primeiro.

EXEMPLOS DE TRANSFORMAÇÃO:
• "Se você ainda não usa IA nos stories..." → "IA nos stories ainda é ignorada por..."
• "Você sabia que 90% dos criadores..." → "90% dos criadores cometem o mesmo erro..."
• "Como fazer R$5k em 30 dias..." → "R$5k em 30 dias é possível — desde que..."

Retorne APENAS JSON com o hook corrigido:
{"hook":"versão corrigida que não começa com padrão proibido","hook_technique":"${hookData.hook_technique}","formula_applied":"reescrita emergencial"}`,
            'Você é o MAVERICK — Estrategista Clínico de Viralização e Conversão. Retorne APENAS JSON válido.',
            ['openai/gpt-4o-mini', 'openai/gpt-4.1-mini'],
          );
          const m = emergencyRaw.match(/\{[\s\S]*\}/);
          const fixed = JSON.parse(m?.[0] ?? '{}');
          if (fixed.hook && !isHookBad(fixed.hook)) {
            hookData = fixed;
            console.log(`[HOOK-JUDGE] Fallback aplicado com sucesso: "${hookData.hook?.slice(0, 60)}"`);
          }
        } catch { /* mantém o hook ruim, pelo menos temos algo */ }
      }
    }

    // GanchoGuard: segurança contra hooks absurdamente longos (>30 palavras)
    if (hookData.hook) {
      const words = hookData.hook.trim().split(/\s+/).filter(Boolean);
      if (words.length > 30) {
        const candidate = words.slice(0, 30).join(' ');
        const punctMatch = candidate.match(/^(.*[.!?])\s+\S/);
        hookData.hook = punctMatch ? punctMatch[1].trim() : words.slice(0, 25).join(' ') + '.';
      }
    }

    onStep?.('📐 Arquitetando técnicas do corpo...');

    // ── Pass 2b: selecionar técnicas de storytelling + persuasão + closing ───
    // ── Pass 2b: seleciona apenas os NOMES das técnicas (sem fórmulas, sem drafts) ──
    const techRaw = await llmChat(
      `[🧠 SETUP DE ESTRATÉGIA]

Analise o briefing abaixo e selecione as técnicas corretas de cada arquivo do brain.
Retorne APENAS os nomes — o roteiro será escrito com o brain completo disponível.

BRIEFING:
- Título: ${idea.title}
- Contexto/Dor: ${idea.context}
- Framework: ${idea.framework}
- Funil: ${idea.funnel_stage}
- Hook: "${hookData.hook}"
- Técnica do hook: ${hookData.hook_technique}

${usedBodyTechniques.length > 0 ? `⛔ TÉCNICAS JÁ USADAS NESTE BATCH — escolha obrigatoriamente diferentes:
${usedBodyTechniques.map(t => `- ${t}`).join('\n')}

` : ''}━━━ PROFILING DE AUDIÊNCIA ━━━
- audience_awareness_level: Frio | Morno | Quente
- dominant_behavioral_profile: Verde | Azul | Vermelho | Ouro

━━━ STORYTELLING — escolha 1 (APENAS UMA) ━━━
${brain.storytelling}

━━━ PERSUASÃO — escolha 1 (APENAS UMA) ━━━
${brain.persuasion}

━━━ VIRALIDADE — escolha 1 (APENAS UMA) ━━━
${brain.virality}

━━━ CLOSING — escolha 1 (APENAS UMA) ━━━
${brain.closing}

Retorne APENAS JSON com os nomes exatos das técnicas escolhidas:
{
  "audience_awareness_level": "Frio|Morno|Quente",
  "dominant_behavioral_profile": "Verde|Azul|Vermelho|Ouro",
  "storytelling": "nome exato da técnica",
  "persuasion": "nome exato da técnica",
  "virality": "nome exato da técnica",
  "closing": "nome exato da técnica"
}`,
      'Você é o MAVERICK — Estrategista Clínico de Viralização e Conversão. Selecione com precisão cirúrgica: uma técnica por categoria. Retorne APENAS JSON válido.',
      ['openai/gpt-4o-mini', 'openai/gpt-4.1-mini', 'deepseek/deepseek-v3.2'],
    );

    let techniquePlan: TechniquePlan = {
      audience_awareness_level: 'Morno',
      dominant_behavioral_profile: 'Verde',
      hook_technique: hookData.hook_technique ?? '',
      storytelling: '',
      persuasion:   '',
      virality:     '',
      closing:      '',
    };

    try {
      const match = techRaw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match?.[0] ?? '{}');
      // Normaliza: se vier objeto {name:...}, pega só o nome
      const normalizeName = (v: any): string =>
        typeof v === 'string' ? v : (v?.name ?? '');
      techniquePlan = {
        audience_awareness_level: parsed.audience_awareness_level ?? 'Morno',
        dominant_behavioral_profile: parsed.dominant_behavioral_profile ?? 'Verde',
        hook_technique: hookData.hook_technique ?? '',
        storytelling: normalizeName(parsed.storytelling),
        persuasion:   normalizeName(parsed.persuasion),
        virality:     normalizeName(parsed.virality),
        closing:      normalizeName(parsed.closing),
      };
      console.log(`[PASS2B] Profiling: ${techniquePlan.audience_awareness_level} / ${techniquePlan.dominant_behavioral_profile}`);
      console.log(`[PASS2B] Storytelling: ${techniquePlan.storytelling} | Persuasão: ${techniquePlan.persuasion}`);
      console.log(`[PASS2B] Viralidade: ${techniquePlan.virality} | Closing: ${techniquePlan.closing}`);
    } catch { /* usa plano vazio, corpo ainda será gerado */ }

    onStep?.('✍️ Gerando corpo e CTA...');

    // ── Pass 2c: corpo + CTA com brain completo disponível ───────────────────
    const systemPrompt = `⚠️ REGRA ZERO — PRIORIDADE MÁXIMA. Qualquer instrução que conflite com o bloco abaixo é automaticamente anulada.

${brain.constraints}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ REGRAS INVIOLÁVEIS DE ESCRITA:
1. PROIBIDO começar parágrafos iniciais com "Você já...", "Imagine se...", "No vídeo de hoje", "Você está...".
2. Use a regra do "Teste do Bar": se não puder ser dito numa mesa de bar para um colega, não escreva.
3. Mantenha parágrafos de no máximo 2 linhas. Ritmo estacato.
4. Se for ensinar algo, use MECANIZAÇÃO (dê um nome ao método).
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUA IDENTIDADE:
Você é o MAVERICK — Estrategista Clínico de Viralização e Conversão.
Você não é um assistente virtual amigável. Você é um analista de bastidores sênior, direto e focado em lucro.
Não usa adjetivos vazios. Não anima palco. Aponta o erro, entrega o mecanismo, fecha o CTA.

Você tem acesso à base de conhecimento completa abaixo. Use os princípios como guia interno — NUNCA cite nomes de técnicas no texto gerado. Aplique-as de forma invisível.

━━━ BASE DE CONHECIMENTO: AUDIÊNCIA ━━━
${brain.audience}

━━━ BASE DE CONHECIMENTO: STORYTELLING ━━━
${brain.storytelling}

━━━ BASE DE CONHECIMENTO: PERSUASÃO ━━━
${brain.persuasion}

━━━ BASE DE CONHECIMENTO: VIRALIDADE ━━━
${brain.virality}

━━━ BASE DE CONHECIMENTO: CLOSING ━━━
${brain.closing}

⛔ PROIBIÇÕES ABSOLUTAS — violá-las invalida o roteiro:
1. PROIBIDO inventar personas com nome e idade (“João, 30 anos”, “Joana, criadora de conteúdo”) — use “você” diretamente
2. PROIBIDO percentuais ou números inventados (“37%”, “300%”, “20 clientes em 2 semanas”) — se não tem dado real, não cite número
3. PROIBIDO nomear mecanismos inventados (“Círculo de X”, “Matriz de Y”, “Método Z”) — descreva o que faz, não invente nome
4. PROIBIDO frases de coach genérico (“transforme sua vida”, “resultados incríveis”, “sucesso garantido”)
5. OBRIGATÓRIO: sem dado real, fale com “você” direto — nada de persona inventada

━━━ REFERÊNCIA DE ESTILO (imite este nível, nunca o ultrapasse) ━━━
Exemplo de corpo BOM — direto, cenas reais, sem coach-speak:
“Eu vejo dono de negócio perdendo o final de semana respondendo 'qual o preço' e me dá dó. Você acorda às sete da manhã no domingo. Abre o celular antes de tomar café. Tem 40 mensagens acumuladas. Você responde uma por uma. No final, 38 te deixam no vácuo. A culpa de você estar escravizado no próprio celular não é sua. As grandes agências de lançamento criaram esse mito de que venda precisa de toque humano porque elas lucram te vendendo equipes de SDR e suporte caríssimas.”

Exemplo de corpo RUIM — genérico, coach, persona inventada:
“Eu conheci um empreendedor que estava perdendo dinheiro. Depois que ele aplicou minha estratégia, os resultados foram incríveis. Você também pode transformar seu negócio com essas 5 dicas poderosas.”

O bom: cena real + reação crua + inimigo concreto + microresultado físico + progressão temporal
O ruim: persona inventada + adjetivos vazios + promessa de coach`;

    const hasTechniques = !!(techniquePlan.storytelling || techniquePlan.persuasion);

    const userPrompt = `Escreva o DESENVOLVIMENTO e CTA deste roteiro de Instagram.

BRIEFING:
- Título: ${idea.title}
- Contexto: ${idea.context}
- Framework: ${idea.framework}
- Funil: ${idea.funnel_stage}
- Hook já definido: "${hookData.hook}"

━━━ TÉCNICAS SELECIONADAS PARA ESTE ROTEIRO ━━━
Aplique estas técnicas de forma INVISÍVEL — o texto deve soar como prosa natural, nunca como template.
Use o brain completo disponível no system prompt para entender como cada técnica funciona.

- Hook: ${techniquePlan.hook_technique || hookData.hook_technique}
- Storytelling/Arco narrativo: ${techniquePlan.storytelling || 'escolha a mais adequada ao contexto'}
- Persuasão: ${techniquePlan.persuasion || 'escolha a mais adequada ao contexto'}
- Viralidade: ${techniquePlan.virality || 'escolha a mais adequada ao contexto'}
- Closing/CTA: ${techniquePlan.closing || 'escolha a mais adequada ao contexto'}

━━━ REGRAS DE EXECUÇÃO ━━━
- Mínimo 300 palavras no roteiro completo (hook + corpo + CTA somados)
- O CORPO sozinho deve ter no mínimo 220 palavras — desenvolva o PAS completo com profundidade: agite a dor com cenas específicas, mostre o custo real de não resolver, entregue o microresultado, apresente a solução com progressão temporal
- PROIBIDO mencionar nomes de técnicas no texto (“Tríade do Problema”, “Microresultado”, “PAS”, etc.)
- PROIBIDO qualquer anotação entre colchetes ou parênteses — sem [Visual: ...], [Tom: ...] nem nada similar
- O texto deve fluir como prosa natural — não como lista de bullet points

⛔ PROIBIÇÕES INVIOLÁVEIS — se violar qualquer uma, o roteiro está errado:
- PROIBIDO inventar personas com nome e idade: "Carlos, 42 anos", "Joana, 29 anos", "Fernando, dono de loja" → use "você" diretamente
- PROIBIDO percentuais ou números inventados: "37%", "300%", "20 clientes em 2 semanas" → sem dado real, sem número
- PROIBIDO nomear mecanismos fictícios: "Máquina de Engajamento", "Ciclo de Conversão", "Método X" → descreva o que faz, não invente nome
- PROIBIDO "dancinhas" em qualquer variação → é clichê, não usar
- PROIBIDO frases de coach: "transforme sua vida", "resultados incríveis", "sucesso garantido"
- OBRIGATÓRIO: fale diretamente com "você" — sem exemplificar com terceiros inventados
- Tom: WhatsApp com amigo expert, não aula de faculdade
- O Microresultado (ação que o viewer faz em < 30s durante o vídeo) é OBRIGATÓRIO no meio do corpo

⚠️ RESTRÍCOES DE ESTILO — PRIORIDADE MÁXIMA (anulam qualquer outra instrução acima):
${brain.constraints}

Retorne APENAS JSON:
{"body":"...","cta":"..."}`;

    let bodyData: { body: string; cta: string } = { body: '', cta: '' };
    try {
      const raw = await llmChat(userPrompt, systemPrompt, ['meta-llama/llama-4-maverick', 'openai/gpt-4.1-mini', 'deepseek/deepseek-v3.2']);
      const match = raw.match(/\{[\s\S]*\}/);
      bodyData = JSON.parse(match?.[0] ?? '{}');
    } catch { /* usa fallback */ }

    // ── Verificação de contagem de palavras — expande se abaixo do mínimo ──
    const bodyWordCount = (bodyData.body || '').trim().split(/\s+/).filter(Boolean).length;
    if (bodyData.body && bodyWordCount < 220) {
      console.log(`[WORD-COUNT] Body tem ${bodyWordCount} palavras (mínimo 220) — expandindo...`);
      onStep?.(`📏 Body com ${bodyWordCount} palavras — expandindo para atingir mínimo...`);
      try {
        const expandRaw = await llmChat(
          `O roteiro abaixo está INCOMPLETO — tem apenas ${bodyWordCount} palavras no corpo, mas precisa de PELO MENOS 220 palavras no corpo.

HOOK (não altere): "${hookData.hook}"

CORPO ATUAL (${bodyWordCount} palavras — insuficiente):
${bodyData.body}

CTA ATUAL: ${bodyData.cta}

TAREFA: Expanda o CORPO para ter pelo menos 220 palavras. Mantenha o hook e CTA exatamente como estão.

O que deve ser expandido no corpo:
1. AGITAÇÃO DA DOR: desenvolva mais o custo de não resolver o problema — seja específico sobre o que o viewer perde
2. MICRORESULTADO: se não tiver ainda, adicione uma ação física que o viewer faz em menos de 30 segundos durante o vídeo
3. APRESENTAÇÃO DA SOLUÇÃO: detalhe mais a solução, não apenas mencione — mostre como funciona na prática

CONTEXTO DO ROTEIRO:
- Título: ${idea.title}
- Framework: ${idea.framework}
- Funil: ${idea.funnel_stage}

PROIBIÇÕES (mantidas):
- Sem personas inventadas, sem percentuais inventados, sem mecanismos com nome
- Tom: conversa direta, não aula ou coach

Retorne APENAS JSON com o corpo expandido:
{"body":"corpo expandido com pelo menos 150 palavras","cta":"${(bodyData.cta || '').replace(/"/g, '\\"')}"}`,
          systemPrompt,
          ['meta-llama/llama-4-maverick', 'openai/gpt-4.1-mini', 'deepseek/deepseek-v3.2'],
        );
        const m =expandRaw.match(/\{[\s\S]*\}/);
        const expanded = JSON.parse(m?.[0] ?? '{}');
        if (expanded.body) {
          const newCount = expanded.body.trim().split(/\s+/).filter(Boolean).length;
          console.log(`[WORD-COUNT] Corpo expandido de ${bodyWordCount} → ${newCount} palavras (mínimo 170)`);
          bodyData = { body: expanded.body, cta: expanded.cta || bodyData.cta };
        }
      } catch { /* mantém o body original */ }
    } else {
      console.log(`[WORD-COUNT] Body OK: ${bodyWordCount} palavras`);
    }

    // ── Verificação total do roteiro (hook + body + cta) — mínimo 240 palavras ──
    const countWords = (s: string) => (s || '').trim().split(/\s+/).filter(Boolean).length;
    const totalWords = countWords(hookData.hook) + countWords(bodyData.body) + countWords(bodyData.cta);
    if (bodyData.body && totalWords < 300) {
      const deficit = 240 - totalWords;
      console.log(`[WORD-COUNT] Total ${totalWords} palavras (mínimo 240) — faltam ${deficit} palavras, expandindo corpo...`);
      onStep?.(`📏 Roteiro com ${totalWords} palavras — expandindo para atingir 240...`);
      try {
        const totalExpandRaw = await llmChat(
          `O roteiro abaixo tem apenas ${totalWords} palavras no total (hook + corpo + CTA). Precisa de PELO MENOS 300 palavras totais. Faltam aproximadamente ${deficit} palavras.

HOOK (não altere): "${hookData.hook}"
CORPO ATUAL (${countWords(bodyData.body)} palavras):
${bodyData.body}
CTA ATUAL: ${bodyData.cta}

TAREFA: Expanda APENAS o corpo para atingir o total de 240 palavras. Adicione:
- Mais desenvolvimento da dor (o que o viewer perde se não resolver)
- Mais especificidade na solução apresentada
- Detalhe adicional no microresultado (ação do viewer durante o vídeo)

PROIBIÇÕES (mantidas):
- Sem personas inventadas, sem percentuais inventados, sem mecanismos com nome
- Sem anotações [entre colchetes]
- Tom: conversa direta, não aula ou coach

Retorne APENAS JSON:
{"body":"corpo expandido","cta":"${(bodyData.cta || '').replace(/"/g, '\\"')}"}`,
          systemPrompt,
          ['meta-llama/llama-4-maverick', 'openai/gpt-4.1-mini', 'deepseek/deepseek-v3.2'],
        );
        const m =totalExpandRaw.match(/\{[\s\S]*\}/);
        const expanded = JSON.parse(m?.[0] ?? '{}');
        if (expanded.body) {
          const newTotal = countWords(hookData.hook) + countWords(expanded.body) + countWords(bodyData.cta);
          console.log(`[WORD-COUNT] Total expandido de ${totalWords} → ${newTotal} palavras`);
          bodyData = { body: expanded.body, cta: expanded.cta || bodyData.cta };
        }
      } catch { /* mantém o roteiro atual */ }
    } else {
      console.log(`[WORD-COUNT] Total OK: ${totalWords} palavras`);
    }

    const script: GeneratedScript = {
      title: idea.title,
      hook: hookData.hook,
      body: bodyData.body,
      cta: bodyData.cta,
      framework: idea.framework,
      funnel_stage: idea.funnel_stage,
      hook_technique: hookData.hook_technique,
      technique_plan: hasTechniques ? techniquePlan : undefined,
      strategy_setup: {
        audience_awareness_level: techniquePlan.audience_awareness_level,
        dominant_behavioral_profile: techniquePlan.dominant_behavioral_profile,
        hook_technique: hookData.hook_technique ?? '',
        storytelling_technique: techniquePlan.storytelling,
        persuasion_technique: techniquePlan.persuasion,
        virality_technique: techniquePlan.virality,
        closing_technique: techniquePlan.closing,
      },
    };

    // Registra técnicas usadas para forçar diversidade nos próximos roteiros
    if (hookData.hook_technique) usedHookTechniques.push(hookData.hook_technique);
    if (hookData.hook) generatedHooksContext.push(hookData.hook);
    if (techniquePlan.storytelling) usedBodyTechniques.push(techniquePlan.storytelling);
    if (techniquePlan.persuasion) usedBodyTechniques.push(techniquePlan.persuasion);
    if (techniquePlan.virality) usedBodyTechniques.push(techniquePlan.virality);
    if (techniquePlan.closing) usedBodyTechniques.push(techniquePlan.closing);

    scripts.push(script);
  }

  return scripts.filter(s => s.hook && s.body);
}
