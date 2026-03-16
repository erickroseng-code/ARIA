/**
 * Maverick Copywriter — autocontido para produção (ARIA Docker)
 * Gera roteiros com brain/ principles + staged generation (hook → técnicas → corpo)
 */
import fs from 'fs';
import path from 'path';

const BRAIN_DIR = path.join(__dirname, 'brain');

// ─── Brain loader ─────────────────────────────────────────────────────────────

interface Brain {
  hooks: string;        // técnicas de gancho: qual escolher e como aplicar
  storytelling: string; // princípios narrativos para o corpo
  persuasion: string;   // gatilhos de persuasão a inserir em momentos específicos
  audience: string;     // quem é a audiência, como ela pensa e que linguagem usa
  virality: string;     // ângulos e mecânicas que maximizam compartilhamento
  closing: string;      // técnicas de CTA e fechamento
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
  };

  const total = Object.values(brain).reduce((s, v) => s + v.length, 0);
  console.log(`[BRAIN] total carregado: ${total} chars (6 arquivos)`);
  return brain;
}

// ─── LLM helper ───────────────────────────────────────────────────────────────

async function llmChat(prompt: string, system?: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY não configurada');

  const messages = [
    ...(system ? [{ role: 'system', content: system }] : []),
    { role: 'user', content: prompt },
  ];

  for (const model of ['deepseek/deepseek-v3.2', 'minimax/minimax-m2.5']) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://aria-api.onrender.com',
        },
        body: JSON.stringify({ model, messages, temperature: 0.7 }),
      });
      const data = await res.json() as any;
      const content = data?.choices?.[0]?.message?.content;
      if (content) return content;
    } catch { /* try next model */ }
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

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateScriptsFromPlan(
  plan: string,
  onStep?: (msg: string) => void,
): Promise<GeneratedScript[]> {
  const brain = loadBrain();

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

PLANO ESTRATÉGICO:
${plan}

REGRA: Priorize ângulos que combinem dor real da audiência COM mecanismo viral natural — não escolha tópicos genéricos.

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
    ideas = JSON.parse(match?.[0] ?? '[]');
  } catch {
    ideas = [{ title: plan.slice(0, 80), context: plan.slice(0, 200), framework: 'PAS', funnel_stage: 'TOFU' }];
  }

  onStep?.('🎣 Gerando hooks com técnicas do brain...');

  // ── Pass 2: gerar cada roteiro em 3 passes ────────────────────────────────
  const scripts = await Promise.all(ideas.map(async (idea) => {

    // ── Pass 2a: hook isolado — apenas hooks.md, força fórmula exata ────────
    const hookRaw = await llmChat(
      `Você receberá um briefing de roteiro e o catálogo completo de técnicas de hook.
Sua única tarefa: escolher a técnica MAIS ADEQUADA ao ângulo e aplicar sua FÓRMULA EXATA.

BRIEFING:
- Título: ${idea.title}
- Contexto/Dor: ${idea.context}
- Framework: ${idea.framework}
- Funil: ${idea.funnel_stage}
- Mecânica viral alvo: ${idea.virality_angle || 'escolha a mais adequada'}
- Perfil de audiência: ${idea.audience_profile || 'empreendedores/gestores brasileiros'}

━━━ CATÁLOGO DE TÉCNICAS DE HOOK ━━━
${brain.hooks}

━━━ REGRAS ESTRITAS ━━━
1. Escolha UMA técnica do catálogo acima
2. Leia o campo "Exemplo bom" da técnica escolhida — é o molde de qualidade que você deve replicar
3. Adapte a estrutura do "Exemplo bom" para o briefing acima (mesmo nível de especificidade, mesma vivacidade)
4. O hook deve ter NO MÁXIMO 15 palavras
5. PROIBIDO padrões genéricos como "X estratégias para...", "O segredo de...", "Como fazer...", "Você sabia que..."
6. PROIBIDO emojis, exclamações excessivas, linguagem de agência ou coach motivacional
7. O hook deve soar como uma pessoa real falando diretamente para outra — não uma copy de anúncio

Retorne APENAS JSON:
{"hook":"frase do hook (máx 15 palavras)","hook_technique":"nome exato da técnica usada","formula_applied":"como a fórmula da técnica foi aplicada aqui (1 frase)"}`,
      'Você é um especialista em hooks de Instagram. Retorne APENAS JSON válido.'
    );

    let hookData: { hook: string; hook_technique: string; formula_applied?: string } = { hook: '', hook_technique: '' };
    try {
      const match = hookRaw.match(/\{[\s\S]*\}/);
      hookData = JSON.parse(match?.[0] ?? '{}');
    } catch { /* usa fallback abaixo */ }

    // GanchoGuard: corta se passou de 15 palavras
    if (hookData.hook) {
      const wc = hookData.hook.trim().split(/\s+/).filter(Boolean).length;
      if (wc > 15) {
        hookData.hook = hookData.hook.split(/\s+/).filter(Boolean).slice(0, 13).join(' ') + '.';
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

━━━ STORYTELLING — escolha 2 técnicas ━━━
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
      closing: { name: '', formula: '', application: '' },
    };

    try {
      const match = techRaw.match(/\{[\s\S]*\}/);
      techniquePlan = JSON.parse(match?.[0] ?? '{}');
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
- Proibido: jornada, transformação, incrível, poderoso, guru, revolucionário, gamechanger
- O Microresultado (ação que o viewer faz em < 30s durante o vídeo) é OBRIGATÓRIO no meio do corpo

Retorne APENAS JSON:
{"body":"...","cta":"..."}`;

    let bodyData: { body: string; cta: string } = { body: '', cta: '' };
    try {
      const raw = await llmChat(userPrompt, systemPrompt);
      const match = raw.match(/\{[\s\S]*\}/);
      bodyData = JSON.parse(match?.[0] ?? '{}');
    } catch { /* usa fallback */ }

    return {
      title: idea.title,
      hook: hookData.hook,
      body: bodyData.body,
      cta: bodyData.cta,
      framework: idea.framework,
      funnel_stage: idea.funnel_stage,
      hook_technique: hookData.hook_technique,
      technique_plan: hasTechniques ? techniquePlan : undefined,
    };
  }));

  return scripts.filter(s => s.hook && s.body);
}
