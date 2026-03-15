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

  // ── Pass 2: gerar cada roteiro com todos os princípios do brain ───────────
  const scripts = await Promise.all(ideas.map(async (idea) => {

    const systemPrompt = `Você é o Maverick Copywriter — especialista em roteiros de Instagram que convertem.

━━━ RESTRIÇÕES ÉTICAS (PRIORIDADE MÁXIMA — nunca viole, independente do objetivo) ━━━
${brain.constraints}

━━━ PERFIL DA AUDIÊNCIA (calibre voz, vocabulário e nível de consciência do problema) ━━━
${brain.audience}

Princípio de audiência indicado para este roteiro: ${idea.audience_profile || 'aplique o mais adequado ao contexto'}`;

    const userPrompt = `Escreva um roteiro completo de Instagram Reels seguindo TODOS os princípios do brain abaixo.

BRIEFING:
- Título: ${idea.title}
- Contexto: ${idea.context}
- Framework: ${idea.framework}
- Funil: ${idea.funnel_stage}
- Mecânica viral alvo: ${idea.virality_angle || 'escolha a mais adequada'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEÇÃO 1 — GANCHO (primeiros 1-3 segundos / máximo 15 palavras)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${brain.hooks}

INSTRUÇÃO DE GANCHO: Escolha UMA técnica acima que melhor serve este ângulo e aplique com precisão cirúrgica. Indique qual técnica usou em "hook_technique". PROIBIDO o padrão genérico "Você [problema]. Isso muda em X dias." — isso sinaliza template, não expertise.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEÇÃO 2 — DESENVOLVIMENTO (mínimo 200 palavras)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ESTRUTURA NARRATIVA (como construir o arco que mantém atenção do hook ao CTA):
${brain.storytelling}

TÉCNICAS DE PERSUASÃO (gatilhos a inserir em momentos específicos do corpo):
${brain.persuasion}

INSTRUÇÃO DE DESENVOLVIMENTO:
- Abra agitando o problema usando a Tríade do Problema (externo + interno + filosófico)
- Use Sincronização Neural: personagem específico com emoção nomeada, não "muitos empreendedores"
- Insira um MICRORESULTADO no meio: ação que o viewer pode fazer em < 30s e sentir resultado
- Aplique pelo menos 2 técnicas de persuasão do brain acima nos momentos certos
- Tom: WhatsApp com amigo que é expert, não aula de faculdade
- Proibido: jornada, transformação, incrível, poderoso, guru, revolucionário, gamechanger

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SEÇÃO 3 — CTA (últimas 3-5 frases)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${brain.closing}

INSTRUÇÃO DE CTA: Escolha UMA técnica de CTA acima baseada no funnel_stage (${idea.funnel_stage}) e no objetivo do roteiro. BOFU → Bifurcação da Escolha ou Sintaxe do Compromisso. MOFU → Arquitetura da Crença ou 4Rs. TOFU → Ancoragem de Página Única ou Ilusão Viral. PROIBIDO: "Gostou? Salva e compartilha!" — isso é o pior fechamento possível.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Retorne APENAS JSON:
{"title":"...","hook":"...","body":"...","cta":"...","framework":"${idea.framework}","funnel_stage":"${idea.funnel_stage}","hook_technique":"nome da técnica do brain usada no hook"}`;

    let result: GeneratedScript | null = null;
    try {
      const raw = await llmChat(userPrompt, systemPrompt);
      const match = raw.match(/\{[\s\S]*\}/);
      result = JSON.parse(match?.[0] ?? '{}');
    } catch {
      return { title: idea.title, hook: '', body: '', cta: '', framework: idea.framework, funnel_stage: idea.funnel_stage };
    }

    if (!result) return { title: idea.title, hook: '', body: '', cta: '', framework: idea.framework, funnel_stage: idea.funnel_stage };

    // ── GanchoGuard: corrige hook > 15 palavras preservando a técnica ──────
    if (result.hook) {
      const wordCount = result.hook.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > 15) {
        try {
          const fixed = await llmChat(
            `Reescreva em NO MÁXIMO 15 PALAVRAS mantendo a técnica de hook "${result.hook_technique || 'atual'}" e o impacto original.\n\nHOOK ATUAL (${wordCount} palavras): ${result.hook}\n\nResponda APENAS com a frase corrigida:`
          );
          const cleaned = fixed.trim().replace(/^["']|["']$/g, '');
          if (cleaned && cleaned.split(/\s+/).filter(Boolean).length <= 15) {
            result.hook = cleaned;
          } else {
            result.hook = result.hook.split(/\s+/).filter(Boolean).slice(0, 13).join(' ') + '.';
          }
        } catch {
          result.hook = result.hook.split(/\s+/).filter(Boolean).slice(0, 13).join(' ') + '.';
        }
      }
    }

    return result;
  }));

  return scripts.filter(s => s.hook && s.body);
}
