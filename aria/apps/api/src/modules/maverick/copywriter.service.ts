/**
 * Maverick Copywriter — autocontido para produção (ARIA Docker)
 * Gera roteiros com brain/ principles + GanchoGuard sem dependência de squads/maverick
 */
import fs from 'fs';
import path from 'path';

const BRAIN_DIR = path.join(__dirname, 'brain');

// ─── Brain loader ─────────────────────────────────────────────────────────────

interface Brain {
  constraints: string; // NUNCA violar — prioridade máxima
  hooks: string;       // técnicas de gancho: qual escolher e como aplicar
  storytelling: string; // estrutura narrativa do corpo
  persuasion: string;  // gatilhos de persuasão a inserir em momentos específicos
  audience: string;    // quem é a audiência, como ela pensa e que linguagem usa
  virality: string;    // ângulos e mecânicas que maximizam compartilhamento
  closing: string;     // técnicas de CTA e fechamento
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
    constraints: load('constraints.md'),
    hooks:       load('hooks.md'),
    storytelling: load('storytelling.md'),
    persuasion:  load('persuasion.md'),
    audience:    load('audience.md'),
    virality:    load('virality.md'),
    closing:     load('closing.md'),
  };

  const total = Object.values(brain).reduce((s, v) => s + v.length, 0);
  console.log(`[BRAIN] total carregado: ${total} chars (7 arquivos)`);
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

export interface GeneratedScript {
  title: string;
  hook: string;
  body: string;
  cta: string;
  framework: string;
  funnel_stage: string;
  hook_technique?: string; // qual técnica do brain foi usada no hook
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateScriptsFromPlan(
  plan: string,
  onStep?: (msg: string) => void,
): Promise<GeneratedScript[]> {
  const brain = loadBrain();

  onStep?.('🧠 Selecionando ângulos e frameworks...');

  // ── Pass 1: selecionar ângulos usando virality + audience para calibrar ──────
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
- audience_profile: qual princípio de audiência (Co-Identidade, Público Inconsciente, Filtro do Otaku, etc.) guia a linguagem

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

  onStep?.('✍️ Gerando roteiros com brain/ principles...');

  // ── Pass 2: gerar cada roteiro com passes focados por seção ─────────────
  const scripts = await Promise.all(ideas.map(async (idea) => {

    // ── Pass 2a: hook isolado — apenas hooks.md, força fórmula exata ──────
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
2. Copie mentalmente a FÓRMULA dessa técnica e aplique ela ao briefing
3. O hook deve ter NO MÁXIMO 15 palavras
4. PROIBIDO padrões genéricos como "X estratégias para...", "O segredo de...", "Como fazer..."
5. O hook deve parecer que veio de uma pessoa real falando no WhatsApp, não de uma agência

Retorne APENAS JSON:
{"hook":"frase do hook (máx 15 palavras)","hook_technique":"nome exato da técnica usada","formula_applied":"como a fórmula da técnica foi aplicada aqui (1 frase)"}`,
      'Você é um especialista em hooks de Instagram. Retorne APENAS JSON válido.'
    );

    let hookData: { hook: string; hook_technique: string; formula_applied?: string } = { hook: '', hook_technique: '' };
    try {
      const match = hookRaw.match(/\{[\s\S]*\}/);
      hookData = JSON.parse(match?.[0] ?? '{}');
    } catch { /* usa fallback abaixo */ }

    // GanchoGuard inline: corta se passou de 15 palavras
    if (hookData.hook) {
      const wc = hookData.hook.trim().split(/\s+/).filter(Boolean).length;
      if (wc > 15) {
        hookData.hook = hookData.hook.split(/\s+/).filter(Boolean).slice(0, 13).join(' ') + '.';
      }
    }

    // ── Pass 2b: corpo + CTA com hook já fixado ───────────────────────────
    const systemPrompt = `Você é o Maverick Copywriter — especialista em roteiros de Instagram que convertem.

━━━ RESTRIÇÕES ÉTICAS (PRIORIDADE MÁXIMA) ━━━
${brain.constraints}

━━━ PERFIL DA AUDIÊNCIA ━━━
${brain.audience}`;

    const userPrompt = `Escreva o DESENVOLVIMENTO e CTA de um roteiro de Instagram Reels.
O hook já está pronto — sua missão é construir o corpo que o justifica e o CTA que converte.

BRIEFING:
- Título: ${idea.title}
- Contexto: ${idea.context}
- Framework: ${idea.framework}
- Funil: ${idea.funnel_stage}
- Hook já definido: "${hookData.hook}"
- Técnica do hook: ${hookData.hook_technique}

━━━ ESTRUTURA NARRATIVA (construa o arco que vai do hook ao CTA) ━━━
${brain.storytelling}

━━━ TÉCNICAS DE PERSUASÃO (insira nos momentos certos do corpo) ━━━
${brain.persuasion}

━━━ INSTRUÇÃO DE DESENVOLVIMENTO ━━━
- NUNCA mencione nomes de técnicas no texto. Aplique de forma invisível — proibido "(Tríade do Problema)", "(Microresultado)" ou qualquer anotação técnica
- Abra agitando o problema com Tríade do Problema (externo + interno + filosófico) — escreva como roteiro, não como análise
- Sincronização Neural: personagem específico com emoção nomeada, não "muitos empreendedores"
- Insira MICRORESULTADO no meio: ação que o viewer faz em < 30s e sente resultado
- Mínimo 200 palavras
- Tom: WhatsApp com amigo expert, não aula de faculdade
- Proibido: jornada, transformação, incrível, poderoso, guru, revolucionário, gamechanger

━━━ TÉCNICAS DE CTA E FECHAMENTO ━━━
${brain.closing}

━━━ INSTRUÇÃO DE CTA ━━━
Funil ${idea.funnel_stage}: ${idea.funnel_stage === 'BOFU' ? 'use Bifurcação da Escolha ou Sintaxe do Compromisso' : idea.funnel_stage === 'MOFU' ? 'use Arquitetura da Crença ou 4Rs' : 'use Ancoragem de Página Única ou Ilusão Viral'}
PROIBIDO: "Gostou? Salva e compartilha!" — isso é o pior fechamento possível.

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
    };
  }));

  return scripts.filter(s => s.hook && s.body);
}
