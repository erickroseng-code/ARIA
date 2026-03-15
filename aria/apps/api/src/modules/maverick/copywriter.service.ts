/**
 * Maverick Copywriter — autocontido para produção (ARIA Docker)
 * Gera roteiros com brain/ principles + GanchoGuard sem dependência de squads/maverick
 */
import fs from 'fs';
import path from 'path';

const BRAIN_DIR = path.join(__dirname, 'brain');

function loadBrainPrinciples(): { hook: string; body: string; cta: string } {
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
  const result = {
    hook: load('hooks.md'),
    body: [load('storytelling.md'), load('persuasion.md'), load('audience.md'), load('virality.md')]
      .filter(Boolean).join('\n\n---\n\n'),
    cta: load('closing.md'),
  };
  console.log(`[BRAIN] princípios carregados — hook: ${result.hook.length}c, body: ${result.body.length}c, cta: ${result.cta.length}c`);
  return result;
}

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

export interface GeneratedScript {
  title: string;
  hook: string;
  body: string;
  cta: string;
  framework: string;
  funnel_stage: string;
}

export async function generateScriptsFromPlan(
  plan: string,
  onStep?: (msg: string) => void,
): Promise<GeneratedScript[]> {
  const brain = loadBrainPrinciples();

  onStep?.('🧠 Selecionando frameworks e ângulos...');

  // Pass 1: extrair ideias e selecionar frameworks
  const ideasRaw = await llmChat(
    `Analise o plano estratégico abaixo e extraia 3-4 ideias de roteiros para Instagram Reels/Carrossel.
Para cada ideia, defina: título, contexto, framework (PAS/AIDA/BAB/HOOK_STORY_OFFER) e estágio de funil (TOFU/MOFU/BOFU).

PLANO:
${plan}

Retorne APENAS JSON array:
[{"title":"...","context":"...","framework":"PAS","funnel_stage":"TOFU"}]`,
    'Você é um estrategista de conteúdo. Retorne APENAS JSON válido.'
  );

  let ideas: Array<{ title: string; context: string; framework: string; funnel_stage: string }> = [];
  try {
    const match = ideasRaw.match(/\[[\s\S]*\]/);
    ideas = JSON.parse(match?.[0] ?? '[]');
  } catch {
    ideas = [{ title: plan.slice(0, 80), context: plan.slice(0, 200), framework: 'PAS', funnel_stage: 'TOFU' }];
  }

  onStep?.('✍️ Gerando roteiros com princípios do brain/...');

  // Pass 2: gerar cada roteiro com brain/ principles
  const scripts = await Promise.all(ideas.map(async (idea) => {
    const prompt = `Escreva um roteiro completo de Instagram Reels para o conteúdo abaixo.

BRIEFING:
- Título: ${idea.title}
- Contexto: ${idea.context}
- Framework: ${idea.framework}
- Funil: ${idea.funnel_stage}

PRINCÍPIOS POR SEÇÃO (aplique obrigatoriamente):

[GANCHO] — máximo 15 palavras, afirmação com número concreto:
${brain.hook ? brain.hook.slice(0, 500) : ''}

[DESENVOLVIMENTO] — mínimo 200 palavras, inclua microresultado que a audiência pode testar agora:
${brain.body ? brain.body.slice(0, 1000) : ''}

[CTA] — fechamento e conversão:
${brain.cta ? brain.cta.slice(0, 400) : ''}

REGRAS:
- GANCHO: MÁXIMO 15 PALAVRAS — afirmação com número, sem pergunta
- DESENVOLVIMENTO: mínimo 200 palavras, tom de WhatsApp, linguagem humana
- Sem palavras: jornada, transformação, incrível, poderoso, guru, revolucionário
- Inclua microresultado: ação simples que o viewer pode fazer agora e sentir resultado

Retorne APENAS JSON:
{"title":"...","hook":"...","body":"...","cta":"...","framework":"${idea.framework}","funnel_stage":"${idea.funnel_stage}"}`;

    let result: GeneratedScript | null = null;
    try {
      const raw = await llmChat(prompt, 'Você é o Maverick Copywriter. Retorne APENAS JSON válido.');
      const match = raw.match(/\{[\s\S]*\}/);
      result = JSON.parse(match?.[0] ?? '{}');
    } catch {
      return { title: idea.title, hook: '', body: '', cta: '', framework: idea.framework, funnel_stage: idea.funnel_stage };
    }

    if (!result) return { title: idea.title, hook: '', body: '', cta: '', framework: idea.framework, funnel_stage: idea.funnel_stage };

    // GanchoGuard: corrige hook > 15 palavras
    if (result.hook) {
      const wordCount = result.hook.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount > 15) {
        try {
          const fixed = await llmChat(
            `Reescreva em NO MÁXIMO 15 PALAVRAS. Afirmação com número concreto.\n\nHOOK ATUAL (${wordCount} palavras): ${result.hook}\n\nResponda APENAS com a frase:`
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
