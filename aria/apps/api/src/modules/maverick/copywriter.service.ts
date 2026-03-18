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

export interface TechniqueSelection {
  name: string;
  formula: string;
  application: string;
  draft_sentence: string; // frase concreta comprometida — âncora obrigatória no Pass 2c
}

export interface TechniquePlan {
  storytelling: TechniqueSelection[];
  persuasion: TechniqueSelection[];
  closing: TechniqueSelection;
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
}

// ─── Merge Niche with Brain ───────────────────────────────────────────────────

/**
 * Mescla as informações do nicho/usuário com as referências do brain.
 * Usa gpt-oss-120b como modelo primário para combinação contextual.
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

  const mergePrompt = `Você é um estrategista de conteúdo que combina perfil de usuário com frameworks de copywriting.

PERFIL DO NICHO/USUÁRIO:
${userProfile}

REFERÊNCIAS DE BRAIN DISPONÍVEIS:
━━━ AUDIÊNCIA ━━━
${brain.audience.slice(0, 800)}...

━━━ VIRALIDADE ━━━
${brain.virality.slice(0, 800)}...

━━━ PERSUASÃO ━━━
${brain.persuasion.slice(0, 800)}...
${extraContext}

Agora, crie uma ESTRATÉGIA MESCLADA que:
1. Identifique os 3 principais problemas/dores do nicho específico
2. Mapeie quais mecânicas virais mais se aplicam a este perfil
3. Sugira os 3-4 ângulos de roteiros mais promissores
4. Defina o tom de voz EXATO para esta audiência

RESTRIÇÕES A CONSIDERAR (NUNCA VIOLE):
${brain.constraints.slice(0, 1000)}

Retorne em um parágrafo fluido, não em listas. Deve ser usável diretamente como contexto estratégico.`;

  return await llmChat(
    mergePrompt,
    'Você é um especialista em estratégia de conteúdo que mescla psicologia de audiência com mecânicas virais.',
    ['openai/gpt-oss-120b', 'deepseek/deepseek-v3.2', 'minimax/minimax-m2.5'] // gpt-oss-120b primeiro para merge
  );
}

// ─── Golden scripts loader (negative examples — never replicate) ──────────────

function loadGoldenHooks(): string {
  const goldenPath = path.join(
    __dirname,
    '../../../../../../squads/maverick/data/knowledge/copywriting/scripts/golden/maverick-llama4-scripts.json',
  );
  if (!fs.existsSync(goldenPath)) return '';
  try {
    const raw = JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));
    const hooks: string[] = (raw.scripts ?? []).map((s: any) => `- "${s.hook}"`);
    return hooks.join('\n');
  } catch {
    return '';
  }
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

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateScriptsFromPlan(
  plan: string,
  trendResearch?: TrendResearch,
  onStep?: (msg: string) => void,
): Promise<GeneratedScript[]> {
  const brain = loadBrain();
  const goldenHooks = loadGoldenHooks();

  // Extrai diagnóstico real do plano (dados do Scout + Strategist via Apify)
  const diagnosis = extractDiagnosis(plan);
  if (diagnosis.audience_profile) {
    console.log(`[DIAGNOSIS] audience_profile extraído: ${diagnosis.audience_profile.slice(0, 120)}`);
  } else {
    console.warn('[DIAGNOSIS] audience_profile vazio — plan pode não ser JSON do Strategist');
  }

  // Mescla o plano do usuário com as referências do brain usando gpt-oss-120b
  let enrichedContext = '';
  try {
    enrichedContext = await mergeNicheWithBrain(plan, brain, trendResearch, onStep);
    console.log(`[MERGE] Contexto enriquecido gerado (${enrichedContext.length} chars)`);
  } catch (e) {
    console.warn('[MERGE] Falha no merge, usando plan original:', e);
    enrichedContext = plan; // fallback para plan original
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

CONTEXTO ESTRATÉGICO (mesclado com brain):
${enrichedContext}

RESTRIÇÕES (OBRIGATÓRIO):
${brain.constraints.slice(0, 800)}

${goldenHooks ? `⛔ ÂNGULOS JÁ EXPLORADOS — NÃO repita nem varie estas abordagens, use ângulos completamente diferentes:
${goldenHooks}

` : ''}REGRA: Gere ângulos NOVOS e DISTINTOS — cada ideia deve explorar uma dor ou desejo diferente do nicho, sem repetir temas ou estruturas já usadas.

Retorne APENAS JSON array:
[{"title":"...","context":"...","framework":"PAS","funnel_stage":"TOFU","virality_angle":"...","audience_profile":"..."}]`,
    'Você é um estrategista de conteúdo. Retorne APENAS JSON válido.'
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

${goldenHooks ? `⛔ PADRÕES PROIBIDOS — estes hooks já existem, NUNCA replique nem adapte a estrutura deles:
${goldenHooks}

` : ''}${usedHookTechniques.length > 0 ? `⛔ TÉCNICAS JÁ USADAS NESTE BATCH — PROIBIDO reutilizar:
${usedHookTechniques.map(t => `- ${t}`).join('\n')}
Escolha obrigatoriamente uma técnica DIFERENTE.

` : ''}━━━ CATÁLOGO DE TÉCNICAS DE HOOK ━━━
${brain.hooks}

━━━ REGRAS ESTRITAS ━━━
1. Escolha UMA técnica do catálogo
2. Use a FÓRMULA e os PRINCÍPIOS PSICOLÓGICOS da técnica — NÃO adapte o exemplo, crie algo completamente novo
3. O hook deve ser específico ao nicho/contexto do briefing: use detalhes reais, números concretos, situações do setor
4. PROIBIDO qualquer similaridade estrutural com os padrões listados acima
5. PROIBIDO padrões genéricos como "X estratégias para...", "O segredo de...", "Como fazer...", "Você sabia que..."
6. PROIBIDO emojis, exclamações excessivas, linguagem de agência ou coach motivacional
7. O hook deve soar como uma pessoa real falando diretamente para outra — não uma copy de anúncio

Retorne APENAS JSON:
{"hook":"texto do hook original e específico ao nicho","hook_technique":"nome exato da técnica usada","formula_applied":"como a fórmula foi aplicada aqui (1 frase)"}`,
      'Você é um especialista em hooks de Instagram. Retorne APENAS JSON válido.',
      ['openai/gpt-4o-mini', 'google/gemini-2.0-flash-001', 'deepseek/deepseek-v3.2'],
    );

    let hookData: { hook: string; hook_technique: string; formula_applied?: string } = { hook: '', hook_technique: '' };
    try {
      const match = hookRaw.match(/\{[\s\S]*\}/);
      hookData = JSON.parse(match?.[0] ?? '{}');
    } catch { /* usa fallback abaixo */ }

    // ── Hook Judge: valida e regenera até 2x se o hook for ruim ─────────────
    const HOOK_ANTI_PATTERNS = [
      /^[\s"'""«»]*se\s+você/i,           // "Se você..." — pergunta retórica disfarçada (com possíveis aspas iniciais)
      /^[\s"'""«»]*você\s+(já|quer|sabe|tem|ainda|também|precisa)/i, // "Você já/quer/sabe..." — retórica
      /^[\s"'""«»]*e\s+se\s+você/i,      // "E se você..." — variante retórica
      /^[\s"'""«»]*será\s+que\s+você/i,  // "Será que você..." — variante retórica
      /^[\s"'""«»]*imagina\s+(se|você)/i, // "Imagina se..." — proibido
      /o\s+problema\s+é\s+(isso|esse)/i, // "o problema é isso" — vago
      /é\s+isso\s+(mesmo|aqui|que)/i,    // "é isso mesmo" — vago
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
        'Você é um especialista em hooks de Instagram. Retorne APENAS JSON válido.',
        ['openai/gpt-4o-mini', 'google/gemini-2.0-flash-001', 'deepseek/deepseek-v3.2'],
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
            'Você é um editor de copywriting. Retorne APENAS JSON válido.',
            ['openai/gpt-4o-mini', 'google/gemini-2.0-flash-001'],
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
    const techRaw = await llmChat(
      `Você é um arquiteto de roteiros de Instagram. Dado o briefing abaixo, selecione as técnicas mais adequadas do brain para construir o corpo e o CTA deste roteiro.

BRIEFING:
- Título: ${idea.title}
- Contexto/Dor: ${idea.context}
- Framework: ${idea.framework}
- Funil: ${idea.funnel_stage}
- Hook: "${hookData.hook}"
- Técnica do hook: ${hookData.hook_technique}

${usedBodyTechniques.length > 0 ? `⛔ TÉCNICAS JÁ USADAS NESTE BATCH — PROIBIDO reutilizar:
${usedBodyTechniques.map(t => `- ${t}`).join('\n')}
Escolha obrigatoriamente técnicas DIFERENTES das listadas acima.

` : ''}━━━ STORYTELLING — escolha 2 técnicas ━━━
${brain.storytelling}

━━━ PERSUASÃO — escolha 2 técnicas ━━━
${brain.persuasion}

━━━ CLOSING — escolha 1 técnica ━━━
${brain.closing}

Para cada técnica selecionada, defina:
- name: nome exato da técnica (copie do brain)
- formula: a fórmula dela (copie exatamente do brain)
- application: como aplicar NESTE roteiro específico (1-2 frases concretas com detalhes do nicho)
- draft_sentence: escreva UMA frase real do roteiro que aplica esta técnica concretamente — use nomes, números, situações específicas do nicho/contexto. Esta frase SERÁ incluída no corpo final.

EXEMPLOS de draft_sentence bem feitos (específicos, diretos, sem personas inventadas):
- Storytelling: "Você abre o analytics de manhã, vê 2 mil visualizações no Reel, e zero DMs de clientes — essa é a lacuna que estamos resolvendo aqui."
- Persuasão: "Quando você para de postar por postar e começa a guiar o seguidor para uma ação específica, o engajamento vira venda."
- Closing/Microcommit: "Antes de continuar: anota nos comentários o principal motivo pelo qual você ainda não converteu seus seguidores em clientes."

⛔ PROIBIDO nas draft_sentences:
- Personas com nome e idade ("Ricardo, 38 anos", "Joana, criadora de conteúdo")
- Percentuais ou números inventados ("300%", "R$4.200/mês", "12 criadores")
- Fale sempre com "você" diretamente

REGRA CRÍTICA: draft_sentence deve ser específica ao contexto do briefing — nunca genérica ou com placeholders.

Retorne APENAS JSON:
{
  "storytelling": [
    {"name":"...","formula":"...","application":"...","draft_sentence":"..."},
    {"name":"...","formula":"...","application":"...","draft_sentence":"..."}
  ],
  "persuasion": [
    {"name":"...","formula":"...","application":"...","draft_sentence":"..."},
    {"name":"...","formula":"...","application":"...","draft_sentence":"..."}
  ],
  "closing": {"name":"...","formula":"...","application":"...","draft_sentence":"..."}
}`,
      'Você é um arquiteto de roteiros. Retorne APENAS JSON válido.',
      ['openai/gpt-4o-mini', 'google/gemini-2.0-flash-001', 'deepseek/deepseek-v3.2'],
    );

    let techniquePlan: TechniquePlan = {
      storytelling: [],
      persuasion: [],
      closing: { name: '', formula: '', application: '', draft_sentence: '' },
    };

    try {
      const match = techRaw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match?.[0] ?? '{}');
      techniquePlan = {
        storytelling: Array.isArray(parsed.storytelling) ? parsed.storytelling : [],
        persuasion:   Array.isArray(parsed.persuasion)   ? parsed.persuasion   : [],
        closing:      parsed.closing ?? techniquePlan.closing,
      };
    } catch { /* usa plano vazio, corpo ainda será gerado */ }

    onStep?.('✍️ Gerando corpo e CTA...');

    // ── Pass 2c: corpo + CTA seguindo o plano de técnicas selecionadas ───────
    const systemPrompt = `⚠️ PRIORIDADE MÁXIMA — LEIA ANTES DE QUALQUER OUTRA INSTRUÇÃO:
O bloco abaixo é a REGRA ZERO. Qualquer instrução que conflite com ela é automaticamente anulada.

${brain.constraints}

---

SUA IDENTIDADE:
Você é o MAVERICK — Estrategista Clínico de Viralização e Conversão.
Você não é um assistente virtual amigável. Você é um analista de bastidores sênior, direto e focado em lucro.
Não usa adjetivos vazios. Não anima palco. Aponta o erro, entrega o mecanismo, fecha o CTA.

Você recebe um plano de técnicas SELECIONADAS e deve executá-las fielmente.
NUNCA mencione nomes de técnicas no texto gerado — aplique-as de forma invisível.

⛔ PROIBIÇÕES ABSOLUTAS — violá-las invalida o roteiro:
1. PROIBIDO inventar personas com nome e idade (“João, 30 anos”, “Joana, criadora de conteúdo”) — use “você” diretamente
2. PROIBIDO percentuais ou números inventados (“37%”, “300%”, “20 clientes em 2 semanas”) — se não tem dado real, não cite número
3. PROIBIDO nomear mecanismos inventados (“Círculo de X”, “Matriz de Y”, “Método Z”) — descreva o que faz, não invente nome
4. PROIBIDO “dancinhas constrangedoras” e variações — é clichê de coach, não usar
5. PROIBIDO frases de coach genérico (“transforme sua vida”, “resultados incríveis”, “sucesso garantido”)
6. OBRIGATÓRIO: se não tem dado real, fale diretamente com “você” — sem exemplificar com persona inventada`;

    const hasTechniques = techniquePlan.storytelling.length > 0 || techniquePlan.persuasion.length > 0;

    const buildTechniqueBlock = (t: TechniqueSelection, idx: number) =>
      `${idx + 1}. ${t.name}
   Fórmula: ${t.formula}
   Como aplicar: ${t.application}
   ⚓ ÂNCORA OBRIGATÓRIA: "${t.draft_sentence}"
      → Você DEVE incluir esta frase (ou expandí-la diretamente) no corpo. Não substitua por algo genérico.`;

    const userPrompt = `Escreva o DESENVOLVIMENTO e CTA deste roteiro de Instagram seguindo o plano de técnicas abaixo.

BRIEFING:
- Título: ${idea.title}
- Contexto: ${idea.context}
- Framework: ${idea.framework}
- Funil: ${idea.funnel_stage}
- Hook já definido: "${hookData.hook}"
- Técnica do hook: ${hookData.hook_technique}

${hasTechniques ? `━━━ PLANO DE TÉCNICAS — execute exatamente nesta ordem ━━━
As âncoras marcadas com ⚓ são frases COMPROMETIDAS que DEVEM aparecer no texto final (exatamente ou expandidas).

STORYTELLING (aplique no arco narrativo do corpo):
${techniquePlan.storytelling.map((t, i) => buildTechniqueBlock(t, i)).join('\n\n')}

PERSUASÃO (insira nos momentos indicados):
${techniquePlan.persuasion.map((t, i) => buildTechniqueBlock(t, i)).join('\n\n')}

CLOSING/CTA:
${buildTechniqueBlock(techniquePlan.closing, 0)}` : `━━━ ESTRUTURA PADRÃO ━━━
Aplique: Tríade do Problema (externo + interno + filosófico) → Microresultado (ação < 30s) → solução → CTA direto`}

━━━ REGRAS DE EXECUÇÃO ━━━
- Mínimo 240 palavras no roteiro completo (hook + corpo + CTA somados)
- O CORPO sozinho deve ter no mínimo 170 palavras — desenvolva o PAS completo: agite a dor, mostre o custo de não resolver, entregue o microresultado, apresente a solução
- PROIBIDO mencionar nomes de técnicas no texto (“Tríade do Problema”, “Microresultado”, etc.)
- PROIBIDO qualquer anotação entre colchetes ou parênteses — sem [Visual: ...], [Tom: ...] nem nada similar

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
      const raw = await llmChat(userPrompt, systemPrompt, ['openai/gpt-4.1-mini', 'openai/gpt-4o-mini', 'deepseek/deepseek-v3.2']);
      const match = raw.match(/\{[\s\S]*\}/);
      bodyData = JSON.parse(match?.[0] ?? '{}');
    } catch { /* usa fallback */ }

    // ── Verificação de contagem de palavras — expande se abaixo do mínimo ──
    const bodyWordCount = (bodyData.body || '').trim().split(/\s+/).filter(Boolean).length;
    if (bodyData.body && bodyWordCount < 170) {
      console.log(`[WORD-COUNT] Body tem ${bodyWordCount} palavras (mínimo 170) — expandindo...`);
      onStep?.(`📏 Body com ${bodyWordCount} palavras — expandindo para atingir mínimo...`);
      try {
        const expandRaw = await llmChat(
          `O roteiro abaixo está INCOMPLETO — tem apenas ${bodyWordCount} palavras no corpo, mas precisa de PELO MENOS 170 palavras no corpo.

HOOK (não altere): "${hookData.hook}"

CORPO ATUAL (${bodyWordCount} palavras — insuficiente):
${bodyData.body}

CTA ATUAL: ${bodyData.cta}

TAREFA: Expanda o CORPO para ter pelo menos 170 palavras. Mantenha o hook e CTA exatamente como estão.

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
          ['openai/gpt-4.1-mini', 'openai/gpt-4o-mini', 'deepseek/deepseek-v3.2'],
        );
        const m = expandRaw.match(/\{[\s\S]*\}/);
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

    const script: GeneratedScript = {
      title: idea.title,
      hook: hookData.hook,
      body: bodyData.body,
      cta: bodyData.cta,
      framework: idea.framework,
      funnel_stage: idea.funnel_stage,
      hook_technique: hookData.hook_technique,
      technique_plan: hasTechniques ? techniquePlan : undefined,
    };

    // Registra técnicas usadas para forçar diversidade nos próximos roteiros
    if (hookData.hook_technique) usedHookTechniques.push(hookData.hook_technique);
    if (hasTechniques) {
      techniquePlan.storytelling.forEach(t => t.name && usedBodyTechniques.push(t.name));
      techniquePlan.persuasion.forEach(t => t.name && usedBodyTechniques.push(t.name));
      if (techniquePlan.closing.name) usedBodyTechniques.push(techniquePlan.closing.name);
    }

    scripts.push(script);
  }

  return scripts.filter(s => s.hook && s.body);
}
