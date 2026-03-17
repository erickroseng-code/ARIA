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

  const models = modelPriority || ['meta-llama/llama-4-maverick', 'deepseek/deepseek-v3.2', 'minimax/minimax-m2.5'];
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

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateScriptsFromPlan(
  plan: string,
  trendResearch?: TrendResearch,
  onStep?: (msg: string) => void,
): Promise<GeneratedScript[]> {
  const brain = loadBrain();
  const goldenHooks = loadGoldenHooks();

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

  // ── Pass 1: selecionar ângulos usando virality + audience ──────────────────
  const ideasRaw = await llmChat(
    `Analise o plano estratégico abaixo e extraia 3-4 ideias de roteiros para Instagram Reels/Carrossel.

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
- audience_profile: qual princípio de audiência guia a linguagem

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
- Perfil de audiência: ${idea.audience_profile || 'empreendedores/gestores brasileiros'}

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
      ['meta-llama/llama-4-maverick', 'deepseek/deepseek-v3.2', 'minimax/minimax-m2.5'],
    );

    let hookData: { hook: string; hook_technique: string; formula_applied?: string } = { hook: '', hook_technique: '' };
    try {
      const match = hookRaw.match(/\{[\s\S]*\}/);
      hookData = JSON.parse(match?.[0] ?? '{}');
    } catch { /* usa fallback abaixo */ }

    // GanchoGuard: segurança contra hooks absurdamente longos (>30 palavras)
    if (hookData.hook) {
      const words = hookData.hook.trim().split(/\s+/).filter(Boolean);
      if (words.length > 30) {
        // Tenta cortar na última pontuação forte dentro de 30 palavras
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

EXEMPLOS de draft_sentence bem feitos (específicos, concretos, não genéricos):
- Storytelling/Neural Sync: "Ricardo, 38 anos, abriu o analytics às 23h e sentiu aquela vergonha familiar: 847 visualizações, nenhum DM de cliente."
- Persuasão/Prova Social: "Em 3 semanas, 12 criadores que aplicaram isso saíram de R$800/mês para R$4.200/mês em contratos fechados via DM."
- Closing/Microcommit: "Antes de continuar assistindo: para no segundo 30 e escreve nos comentários qual desses 3 erros você estava cometendo."

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
      'Você é um arquiteto de roteiros. Retorne APENAS JSON válido.'
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
    const systemPrompt = `Você é o Maverick Copywriter — especialista em roteiros de Instagram que convertem.
Você recebe um plano de técnicas SELECIONADAS e deve executá-las fielmente.
NUNCA mencione nomes de técnicas no texto gerado — aplique-as de forma invisível.`;

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
- Mínimo 200 palavras no corpo
- PROIBIDO mencionar nomes de técnicas no texto ("Tríade do Problema", "Microresultado", etc.)
- PROIBIDO qualquer anotação entre colchetes ou parênteses — sem [Visual: ...], [Tom: ...] nem nada similar
- Tom: WhatsApp com amigo expert, não aula de faculdade
- O Microresultado (ação que o viewer faz em < 30s durante o vídeo) é OBRIGATÓRIO no meio do corpo

RESTRIÇÕES DE ESTILO (PRIORIDADE MÁXIMA):
${brain.constraints}

Retorne APENAS JSON:
{"body":"...","cta":"..."}`;

    let bodyData: { body: string; cta: string } = { body: '', cta: '' };
    try {
      const raw = await llmChat(userPrompt, systemPrompt);
      const match = raw.match(/\{[\s\S]*\}/);
      bodyData = JSON.parse(match?.[0] ?? '{}');
    } catch { /* usa fallback */ }

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
