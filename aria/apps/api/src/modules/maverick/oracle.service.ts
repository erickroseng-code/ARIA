import { tavily } from '@tavily/core';
import path from 'path';
import fs from 'fs';
import { resolveMaverickBrainPath } from './brain-path';

// ─── Brain path (shared with copywriter.v2.service) ──────────────────────────
const BRAIN_PATH = resolveMaverickBrainPath(__dirname);

function readBrainFile(relativePath: string): string {
  try {
    return fs.readFileSync(path.join(BRAIN_PATH, relativePath), 'utf-8');
  } catch {
    return '';
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OracleInput {
  rawIdea: string;
}

export interface OracleOutput {
  niche: string;
  targetAudience: string;
  enemy: string;
  mechanism: string;
  pains: string[];
  sources: { title: string; url: string; snippet: string }[];
}

// ─── Tavily Search (Web Scraping inteligente) ────────────────────────────────

async function searchWeb(queries: string[]): Promise<{ title: string; url: string; content: string }[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error(
      'TAVILY_API_KEY não configurado. Em produção (Render), adicione em Environment no dashboard.'
    );
  }

  const client = tavily({ apiKey });

  const allResults: { title: string; url: string; content: string }[] = [];

  // Executa as queries em paralelo (máx 3 para não estourar rate limit)
  const searchPromises = queries.slice(0, 3).map(async (query) => {
    try {
      const response = await client.search(query, {
        searchDepth: 'advanced',
        maxResults: 5,
        includeDomains: ['reddit.com', 'quora.com', 'youtube.com', 'twitter.com', 'x.com'],
      });
      return response.results.map((r: any) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        content: r.content ?? '',
      }));
    } catch (err) {
      console.error(`[Oracle] Tavily search error for "${query}":`, err);
      return [];
    }
  });

  const results = await Promise.all(searchPromises);
  results.forEach(batch => allResults.push(...batch));

  return allResults;
}

// ─── Discover Niche Context ──────────────────────────────────────────────────

export interface DiscoverInput {
  niche: string;
  objective: string;
  period: number; // 30 | 45 | 60 | 90
}

export interface DiscoverOutput {
  keywords: string[];
  themes: { title: string; pain: string }[];
  niche: string;
  enemy: string;
}

export async function discoverNicheContext(input: DiscoverInput): Promise<DiscoverOutput> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) throw new Error('GROQ_API_KEY não configurado');

  // 1. Gerar queries para descobrir dores reais do nicho
  const queryPrompt = `Nicho: "${input.niche}" | Objetivo: ${input.objective}
Gere 3 queries de busca para encontrar DORES REAIS e RECLAMAÇÕES neste nicho.
Retorne APENAS JSON array: ["query1", "query2", "query3"]`;

  const queryRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqApiKey}` },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Retorne APENAS JSON válido.' },
        { role: 'user', content: queryPrompt },
      ],
      temperature: 0.7,
      max_tokens: 200,
    }),
  });
  const queryData = await queryRes.json() as any;
  const queryRaw = queryData.choices?.[0]?.message?.content ?? '[]';
  let queries: string[];
  try {
    const m = queryRaw.match(/\[[\s\S]*\]/);
    queries = m ? JSON.parse(m[0]) : [`${input.niche} problemas reclamações`];
  } catch {
    queries = [`${input.niche} problemas reclamações`];
  }

  // 2. Buscar na web via Tavily
  const webResults = await searchWeb(queries);

  // 3. Sintetizar keywords + temas
  const webContext = webResults.slice(0, 8)
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.content.slice(0, 300)}`)
    .join('\n\n---\n\n');

  const synthPrompt = `Nicho: "${input.niche}" | Objetivo: ${input.objective}

DADOS DA WEB:
${webContext || 'Sem dados. Use conhecimento interno.'}

Identifique:
1. 3-5 keywords para busca no Instagram (em português, específicas)
2. 4-6 temas em alta (o que o público reclama ou quer saber)
3. O inimigo comum do mercado
4. O nicho ultra-específico

Retorne APENAS JSON:
{
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "themes": [
    { "title": "Título curto", "pain": "Por que dói para o público" }
  ],
  "niche": "Nicho ultra-específico",
  "enemy": "O vilão do mercado"
}`;

  const synthRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqApiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Retorne APENAS JSON válido. Sem markdown.' },
        { role: 'user', content: synthPrompt },
      ],
      temperature: 0.6,
      max_tokens: 800,
    }),
  });
  const synthData = await synthRes.json() as any;
  const synthRaw = synthData.choices?.[0]?.message?.content ?? '';
  const jsonMatch = synthRaw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Resposta do Discovery inválida');
  return JSON.parse(jsonMatch[0]) as DiscoverOutput;
}

// ─── Oracle Engine ───────────────────────────────────────────────────────────

export async function runOracle(input: OracleInput): Promise<OracleOutput> {
  const persona = readBrainFile('07_persona.md');

  // 1. Gerar queries de investigação via LLM rápida
  const queryGenPrompt = `Você é um pesquisador de mercado implacável. 
O usuário quer criar conteúdo/produtos digitais mas só tem essa ideia vaga:

"${input.rawIdea}"

Gere EXATAMENTE 3 queries de busca em português para encontrar DORES REAIS, RECLAMAÇÕES e FRUSTRAÇÕES das pessoas nesse nicho.
As queries devem focar em:
1. Reclamações e frustrações reais (ex: "problema com [nicho]" "dificuldade" "não funciona")
2. Perguntas que as pessoas fazem desesperadas (ex: "como resolver [problema do nicho]" "ajuda")  
3. Críticas e inimigos do mercado (ex: "[nicho] é furada" "não compre" "cuidado")

Retorne APENAS um JSON array de strings, sem markdown:
["query 1", "query 2", "query 3"]`;

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) throw new Error('GROQ_API_KEY não configurado');

  // Chamada rápida para gerar queries
  const queryRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Retorne APENAS JSON válido. Sem explicações.' },
        { role: 'user', content: queryGenPrompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  const queryData = await queryRes.json() as any;
  const queryRaw = queryData.choices?.[0]?.message?.content ?? '[]';
  let queries: string[];
  try {
    const match = queryRaw.match(/\[[\s\S]*\]/);
    queries = match ? JSON.parse(match[0]) : [`${input.rawIdea} problemas reclamações`];
  } catch {
    queries = [`${input.rawIdea} problemas reclamações`];
  }

  console.log('[Oracle] Generated queries:', queries);

  // 2. Buscar na web via Tavily
  const webResults = await searchWeb(queries);
  console.log(`[Oracle] Found ${webResults.length} web results`);

  // 3. Montar o contexto com os dados reais da web
  const webContext = webResults
    .slice(0, 12)
    .map((r, i) => `[${i + 1}] (${r.url})\n${r.title}\n${r.content.slice(0, 500)}`)
    .join('\n\n---\n\n');

  // 4. Sintetizar o Niche Blueprint via LLM pesada
  const synthesisPrompt = `<PERSONA>
${persona}
</PERSONA>

Você é o ORÁCULO do Maverick. Você acaba de raspar a internet e encontrou reclamações, dúvidas e frustrações REAIS de pessoas neste mercado.

A ideia bruta do usuário: "${input.rawIdea}"

DADOS REAIS DA WEB (extraídos agora de Reddit, Quora, YouTube, Twitter):
${webContext || 'Nenhum resultado encontrado. Use seu conhecimento interno para gerar o blueprint baseado na ideia.'}

MISSÃO: Analise os dados da web e gere um NICHE BLUEPRINT ultra-preciso.

REGRAS:
- O nicho NÃO pode ser genérico (ex: "Marketing Digital" é proibido). Deve ser um "Oceano Azul" hyper-específico.
- O inimigo deve ser um VILÃO REAL que as pessoas reclamam nos dados (não um conceito abstrato).
- O mecanismo único deve ter um NOME inventado (formato: [Termo Técnico] + [Benefício]).
- As dores devem ser CITAÇÕES ou PARÁFRASES das reclamações reais encontradas na web.

Retorne APENAS JSON válido neste formato exato:
{
  "niche": "O nicho ultra-específico descoberto",
  "targetAudience": "Quem é o público ideal com características reais",
  "enemy": "O vilão/inimigo do mercado baseado nas reclamações",
  "mechanism": "Nome inventado do Mecanismo Único",
  "pains": [
    "Dor real 1 (baseada nos dados da web)",
    "Dor real 2 (baseada nos dados da web)", 
    "Dor real 3 (baseada nos dados da web)"
  ]
}`;

  const synthRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Retorne APENAS JSON válido. Sem markdown, sem explicações.' },
        { role: 'user', content: synthesisPrompt },
      ],
      temperature: 0.6,
      max_tokens: 1000,
    }),
  });

  const synthData = await synthRes.json() as any;
  const synthRaw = synthData.choices?.[0]?.message?.content ?? '';

  const jsonMatch = synthRaw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Resposta do Oráculo inválida');

  const blueprint = JSON.parse(jsonMatch[0]) as Omit<OracleOutput, 'sources'>;

  // 5. Devolver o blueprint + as fontes reais
  return {
    ...blueprint,
    sources: webResults.slice(0, 5).map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 200),
    })),
  };
}
