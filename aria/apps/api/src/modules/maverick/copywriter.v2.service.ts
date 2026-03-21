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
  const persona = readBrainFile('core/persona.md');

  const systemPrompt = `<PERSONA>
${persona}
</PERSONA>

Você está na FASE 1 (O ESTRATEGISTA). Sua missão aqui é analisar o nicho e público fornecidos
e construir uma Pirâmide de Conteúdo estratégica com Pilares que refletem o Inimigo Comum,
a Dor Latejante e o Desejo Inconfessável daquele nicho.
Retorne APENAS um JSON válido, sem markdown, sem explicações extras.`;

  const userPrompt = `Nicho: ${input.niche}
Público-alvo: ${input.targetAudience}

Crie uma pirâmide de conteúdo com 3 Pilares Macro estratégicos e 5 Micro-temas por pilar.
Os temas devem ser ultra-específicos — não genéricos. Use números, situações e personagens concretos.
Retorne neste formato JSON exato:
{
  "pillars": [
    { "name": "Nome do Pilar", "topics": ["tema específico 1", "tema específico 2", "tema específico 3", "tema específico 4", "tema específico 5"] }
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
  const persona = readBrainFile('core/persona.md');
  const hooks = readBrainFile('hooks.md'); // Carrega o arquivo de hooks do brain

  // Selecionar 3 fórmulas rotativas para injetar
  const formulas = selectFormulasForTopic(input.topic, 3);
  const formulasText = formulas.length > 0
    ? formulas.map((f, i) => `## FÓRMULA ${i + 1}\n${f}`).join('\n\n---\n\n')
    : 'Use técnicas de copywriting persuasivo e específico.';

  const systemPrompt = `<PERSONA>
${persona}
</PERSONA>

Você está na FASE 2 (O IDEATOR). Sua missão: NUNCA inventar ângulos do zero.
Injetar o tema nas FÓRMULAS abaixo e usar os HOOKS do brain para garantir ganchos de parada de scroll.

<HOOKS_REFERENCE>
${hooks}
</HOOKS_REFERENCE>

<FORMULAS>
${formulasText}
</FORMULAS>

REGRAS ABSOLUTAS:
- Hook: NUNCA pergunta retórica. Use afirmação chocante, número específico ou cena fotográfica.
- Ângulo: máximo 1 linha. Ultra-específico. Com número, personagem ou situação concreta.
- Anti-IA: zero clichês. Zero "incrível", "transformador", "essencial".
- Retorne APENAS JSON válido, sem markdown.`;

  const userPrompt = `Nicho: ${input.niche}
Público-alvo: ${input.targetAudience}
Tema: ${input.topic}

Gere 5 cards de ângulo com personagens e situações ultra-específicas. Cada card deve ser radicalmente diferente em abordagem.
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
  // 1. Carregar a Persona Mestre + Constituição
  const persona = readBrainFile('core/persona.md');
  const vetoes = readBrainFile('core/vetoes.md');
  const tone = readBrainFile('core/tone.md');

  // 2. Selecionar o Swipe File RAG aderente ao formato
  const swipe = selectSwipeForFormat(input.format);

  // 3. Selecionar 2 fórmulas complementares via Router
  const formulas = selectFormulasForTopic(input.angle, 2);
  const formulasText = formulas.map((f, i) => `### FÓRMULA DE ESTRUTURA ${i + 1}\n${f}`).join('\n\n');

  // 4. Definir estrutura exata por formato (FASE 3 da Persona)
  const formatStructure = input.format === 'reels'
    ? `ESTRUTURA OBRIGATÓRIA PARA REELS:
- 00-03s: Hook Visual e Auditivo agressivo (use o GANCHO INICIAL como base)
- 03-10s: Entrega rápida do valor ou promessa
- 10-45s: Conteúdo em bullets (frases curtas e quebradas)
- Final: CTA baseado em curiosidade (ex: "Leia a legenda para o passo a passo")`
    : input.format === 'carousel'
    ? `ESTRUTURA OBRIGATÓRIA PARA CARROSSEL:
- Slide 1: Headline de revista (Curiosidade + Benefício)
- Slide 2: O Problema (Agitar a dor)
- Slides 3-7: A Solução em passos práticos
- Slide 8: Checklist ou Resumo (Para gerar o print/salvamento)
- Slide 9: CTA`
    : `ESTRUTURA OBRIGATÓRIA PARA PÁGINA DE VENDAS:
- Headline: Mecanismo Único + Resultado Desejado
- Lead: Narrativa de transformação
- Oferta: O que é, para quem é, bônus e garantia
- FAQ: Quebra de objeções reais com prova social e urgência`;

  // 5. Super-Prompt final com hierarquia XML
  const systemPrompt = `<PERSONA>
${persona}
</PERSONA>

Você está na FASE 3 (O EXECUTOR). Prioridade de obediência: PERSONA > CONSTITUTION > FRAMEWORK > SWIPE.

<CONSTITUTION>
${vetoes}

---

${tone}
</CONSTITUTION>

<FRAMEWORK>
${formulasText}
</FRAMEWORK>

<SWIPE_FILE_SKELETON>
Use como REFERÊNCIA DE RITMO E CADÊNCIA, não de conteúdo literal.
Mantenha proporção de blocos, tamanho de frases e posição da virada narrativa.
ADAPTE completamente para o nicho e tema.

${swipe}
</SWIPE_FILE_SKELETON>

<FORMAT_STRUCTURE>
${formatStructure}
</FORMAT_STRUCTURE>

Entregue APENAS a copy final, sem explicações, sem meta-comentários, sem títulos de seção.`;

  const userPrompt = `NICHO: ${input.niche}
PÚBLICO-ALVO: ${input.targetAudience}
ÂNGULO ESCOLHIDO: ${input.angle}
GANCHO INICIAL: ${input.hook}

Escreva a copy completa. Siga a <FORMAT_STRUCTURE> à risca. Use o <SWIPE_FILE_SKELETON> para cadência. Aplique a <CONSTITUTION> e o <FRAMEWORK> para garantir alta conversão. Assuma a <PERSONA> do Maverick — direto, visceral, sem clichês.`;

  yield* callGroqStream(systemPrompt, userPrompt, 'meta-llama/llama-4-maverick');
}
