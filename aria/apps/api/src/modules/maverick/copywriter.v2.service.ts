import fs from 'fs';
import path from 'path';

// Diretório raiz do Cérebro Modular
const BRAIN_PATH = path.resolve(
  __dirname,
  '../../../../../../squads/maverick/data/knowledge/brain'
);

// ─── Leitura do Cérebro ──────────────────────────────────────────────────────

function readBrainFile(relativePath: string): string {
  try {
    const fullPath = path.join(BRAIN_PATH, relativePath);
    return fs.readFileSync(fullPath, 'utf-8');
  } catch {
    return '';
  }
}

function readAllFormulas(): { name: string; content: string }[] {
  const formulasDir = path.join(BRAIN_PATH, 'formulas');
  try {
    const files = fs.readdirSync(formulasDir).filter(f => f.endsWith('.md'));
    return files.map(f => ({
      name: f.replace('.md', ''),
      content: fs.readFileSync(path.join(formulasDir, f), 'utf-8'),
    }));
  } catch {
    return [];
  }
}

function readSwipeFiles(): { name: string; content: string }[] {
  const swipesDir = path.join(BRAIN_PATH, 'swipes');
  try {
    const files = fs.readdirSync(swipesDir).filter(f => f.endsWith('.md'));
    return files.map(f => ({
      name: f.replace('.md', ''),
      content: fs.readFileSync(path.join(swipesDir, f), 'utf-8'),
    }));
  } catch {
    return [];
  }
}

// ─── Seletor de Fórmulas (Router rápido determinístico) ──────────────────────

function selectFormulasForTopic(topic: string, count = 3): string[] {
  const all = readAllFormulas();
  if (all.length === 0) return [];

  // Heurística simples: rotacionar baseado no hash do tópico para variedade
  const hash = topic.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const shuffled = [...all].sort((a, b) =>
    ((hash + a.name.length) % 7) - ((hash + b.name.length) % 7)
  );

  return shuffled.slice(0, count).map(f => f.content);
}

function selectSwipeForFormat(format: string): string {
  const swipes = readSwipeFiles();
  if (swipes.length === 0) return '';

  // Preferência por nome de arquivo que mencione o formato
  const match = swipes.find(s => s.name.toLowerCase().includes(format.toLowerCase()));
  return match ? match.content : swipes[0].content;
}

// ─── Chamada à LLM (Groq) ────────────────────────────────────────────────────

async function callGroq(systemPrompt: string, userPrompt: string, model: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY não configurado');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1024,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error (${response.status}): ${err}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content ?? '';
}

async function* callGroqStream(systemPrompt: string, userPrompt: string, model: string): AsyncGenerator<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY não configurado');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2048,
      temperature: 0.85,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const err = await response.text();
    throw new Error(`Groq Stream error (${response.status}): ${err}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (trimmed.startsWith('data: ')) {
        try {
          const chunk = JSON.parse(trimmed.slice(6));
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch { /* skip malformed chunk */ }
      }
    }
  }
}

// ─── Serviço de Onboarding: Gera a Pirâmide de Conteúdo ─────────────────────

export interface OnboardingInput {
  niche: string;
  targetAudience: string;
}

export interface ContentPyramid {
  pillars: {
    name: string;
    topics: string[];
  }[];
}

export async function generateContentPyramid(input: OnboardingInput): Promise<ContentPyramid> {
  const systemPrompt = `Você é um estrategista de conteúdo especialista em marketing digital.
Sua tarefa é criar uma Pirâmide de Conteúdo estruturada para um criador de conteúdo.
Retorne APENAS um JSON válido, sem markdown, sem explicações extras.`;

  const userPrompt = `Nicho: ${input.niche}
Público-alvo: ${input.targetAudience}

Crie uma pirâmide de conteúdo com 3 Pilares Macro e 5 Micro-temas por pilar.
Retorne neste formato JSON exato:
{
  "pillars": [
    { "name": "Nome do Pilar", "topics": ["tema1", "tema2", "tema3", "tema4", "tema5"] }
  ]
}`;

  const raw = await callGroq(systemPrompt, userPrompt, 'llama3-8b-8192');

  // Extrair JSON da resposta
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Resposta de onboarding inválida');
  return JSON.parse(jsonMatch[0]) as ContentPyramid;
}

// ─── Serviço de Ideação: Gera Cards de Ângulos ───────────────────────────────

export interface IdeatorInput {
  niche: string;
  targetAudience: string;
  topic: string;
}

export interface IdeaCard {
  id: string;
  angle: string;
  hook: string;
}

export async function generateIdeaCards(input: IdeatorInput): Promise<IdeaCard[]> {
  // Selecionar 3 fórmulas rotativas para injetar
  const formulas = selectFormulasForTopic(input.topic, 3);
  const formulasText = formulas.length > 0
    ? formulas.map((f, i) => `## FÓRMULA ${i + 1}\n${f}`).join('\n\n---\n\n')
    : 'Use técnicas de copywriting persuasivo e específico.';

  const systemPrompt = `Você é um especialista em Copywriting e Engenharia de Ângulos de Conteúdo.
Sua função exclusiva é: dado um tema genérico + um nicho, gerar ângulos ultra-específicos que parem o scroll.
Você NÃO inventa nada do zero. Você injeta o tema nas FÓRMULAS abaixo e cospe os resultados.

${formulasText}

REGRAS ABSOLUTAS:
- Nunca use perguntas retóricas ("Você já se sentiu...?")
- Nunca use adjetivos de hype ("incrível", "fantástico")
- Seja específico: números quebrados, nomes de personagens, cenas fotográficas
- Cada ângulo deve ter no máximo 2 linhas
- Retorne APENAS JSON válido`;

  const userPrompt = `Nicho: ${input.niche}
Público-alvo: ${input.targetAudience}
Tema: ${input.topic}

Gere 5 cards de ângulo altamente específicos e diferentes entre si.
Retorne neste formato JSON exato:
{
  "cards": [
    { "id": "1", "angle": "Título do ângulo específico", "hook": "A frase de abertura (1-2 linhas max)" }
  ]
}`;

  const raw = await callGroq(systemPrompt, userPrompt, 'llama3-8b-8192');
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Resposta do Ideator inválida');

  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.cards as IdeaCard[];
}

// ─── Serviço de Geração: O Copywriter RAG ────────────────────────────────────

export interface GenerateInput {
  niche: string;
  targetAudience: string;
  angle: string;
  hook: string;
  format: 'reels' | 'carousel' | 'sales_page';
}

export async function* generateScript(input: GenerateInput): AsyncGenerator<string> {
  // 1. Montar a Constituição (sempre incluída)
  const vetoes = readBrainFile('core/vetoes.md');
  const tone = readBrainFile('core/tone.md');

  // 2. Selecionar o Swipe File mais aderente ao formato (RAG)
  const swipe = selectSwipeForFormat(input.format);

  // 3. Selecionar 2 fórmulas complementares via Router
  const formulas = selectFormulasForTopic(input.angle, 2);
  const formulasText = formulas.map((f, i) => `### FÓRMULA DE ESTRUTURA ${i + 1}\n${f}`).join('\n\n');

  // 4. Montar o Super-Prompt via XML Tags para máxima obediência do LLM
  const systemPrompt = `Você é um Copywriter Nível A-List. Sua missão é redigir uma copy de alta conversão para o formato solicitado.
Você obedece estritamente os blocos abaixo. Qualquer conflito entre blocos: <CONSTITUTION> tem prioridade máxima.

<CONSTITUTION>
${vetoes}

---

${tone}
</CONSTITUTION>

<FRAMEWORK>
${formulasText}
</FRAMEWORK>

<SWIPE_FILE_SKELETON>
Use o esqueleto abaixo como REFERÊNCIA DE RITMO E CADÊNCIA, não de conteúdo literal.
Mantenha a proporção de blocos, tamanho de frases e posição da virada narrativa.
ADAPTE completamente para o nicho e tema do usuário.

${swipe}
</SWIPE_FILE_SKELETON>

FORMATO DE ENTREGA: ${input.format === 'reels' ? 'Roteiro de Reels (60-90 segundos de fala)' : input.format === 'carousel' ? 'Texto para Carrossel (slides curtos, máx 30 palavras por slide)' : 'Página de Vendas (long-form, múltiplos blocos com CTAs progressivos)'}
Entregue APENAS a copy final, sem explicações, sem meta-comentários.`;

  const userPrompt = `NICHO: ${input.niche}
PÚBLICO-ALVO: ${input.targetAudience}
ÂNGULO ESCOLHIDO: ${input.angle}
GANCHO INICIAL: ${input.hook}

Escreva a copy completa seguindo a <CONSTITUTION>, moldando este ângulo dentro do <FRAMEWORK>, com a cadência e ritmo do <SWIPE_FILE_SKELETON>.`;

  yield* callGroqStream(systemPrompt, userPrompt, 'meta-llama/llama-4-maverick');
}
