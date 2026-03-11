import { randomBytes } from 'crypto';
import { generateCarouselStructure, ScriptInput } from './carousel-designer/index';
import { generateCarouselHtml } from './carousel-designer/html-export';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BatchTopic {
  topic: string;
  status: 'success' | 'error' | 'timeout';
  carousel?: {
    title: string;
    total_slides: number;
    slides: Array<{
      position: number;
      type: 'cover' | 'content' | 'cta';
      title: string;
      body: string;
      visual_hint: string;
    }>;
    htmlExport: string;
  };
  error?: string;
}

export interface BatchResult {
  batchId: string;
  generatedAt: string;
  topics: BatchTopic[];
}

// ── In-memory store (cleared on restart — acceptable for MVP) ─────────────────
const batchStore = new Map<string, BatchResult>();

const TOPIC_TIMEOUT_MS = 5 * 60 * 1000; // 5 min per topic (AC: 6)
const BATCH_TTL_MS = 24 * 60 * 60 * 1000; // 24h retention (AC: 7)

// ── Public API ─────────────────────────────────────────────────────────────────

export async function runWeeklyBatch(
  topics: string[],
  theme: 'dark' | 'light' = 'dark',
  openrouterApiKey: string,
  scriptOptions: { maxAgeDays?: number } = {},
): Promise<BatchResult> {
  const batchId = `batch-${new Date().toISOString().slice(0, 10)}-${randomBytes(4).toString('hex')}`;
  const results: BatchTopic[] = [];

  for (const topic of topics) {
    const result = await processTopicSafe(topic, theme, openrouterApiKey, scriptOptions);
    results.push(result);
  }

  const batch: BatchResult = {
    batchId,
    generatedAt: new Date().toISOString(),
    topics: results,
  };

  batchStore.set(batchId, batch);
  setTimeout(() => batchStore.delete(batchId), BATCH_TTL_MS);

  return batch;
}

export function getBatch(batchId: string): BatchResult | undefined {
  return batchStore.get(batchId);
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Wraps processTopic with per-topic error and timeout handling (AC: 4, 6).
 * A failing topic never breaks the rest of the batch.
 */
async function processTopicSafe(
  topic: string,
  theme: 'dark' | 'light',
  openrouterApiKey: string,
  scriptOptions: { maxAgeDays?: number },
): Promise<BatchTopic> {
  const timeout = new Promise<BatchTopic>((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), TOPIC_TIMEOUT_MS),
  );

  const work = processTopic(topic, theme, openrouterApiKey, scriptOptions);

  try {
    return await Promise.race([work, timeout]);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'TIMEOUT') {
      return { topic, status: 'timeout', error: 'Tempo limite de 5 minutos excedido' };
    }
    return { topic, status: 'error', error: message };
  }
}

async function processTopic(
  topic: string,
  theme: 'dark' | 'light',
  openrouterApiKey: string,
  _scriptOptions: { maxAgeDays?: number },
): Promise<BatchTopic> {
  const script = await generateSimpleScript(topic, openrouterApiKey);
  const carousel = generateCarouselStructure(script);
  const htmlExport = generateCarouselHtml(carousel, theme);

  return {
    topic,
    status: 'success',
    carousel: {
      title: carousel.title,
      total_slides: carousel.total_slides,
      slides: carousel.slides,
      htmlExport,
    },
  };
}

/**
 * Generates a carousel script directly from a topic using an LLM.
 * No Instagram scraping — uses model knowledge to produce educational content.
 */
async function generateSimpleScript(
  topic: string,
  openrouterApiKey: string,
): Promise<ScriptInput> {
  const prompt = `Crie um script de carrossel educativo para Instagram sobre: "${topic}"

Responda APENAS com JSON válido no formato:
{
  "title": "título chamativo e curto (máx 60 chars)",
  "format": "Carrossel Educativo",
  "hook": "primeira frase de impacto para a capa (máx 80 chars). Deve provocar curiosidade ou mostrar a transformação prometida.",
  "body": "corpo do conteúdo com 4 parágrafos curtos separados por linha em branco. Cada parágrafo = 1 slide. Máx 100 chars por parágrafo.",
  "visual_cues": ["dica visual slide capa", "dica slide 2", "dica slide 3", "dica slide 4", "dica slide 5"],
  "cta": "chamada para ação final (máx 80 chars). Ex: 'Salve para lembrar depois!' ou 'Compartilhe com quem precisa!'"
}

REGRAS:
- Português brasileiro, tom direto e prático
- Foco na transformação / resultado do leitor
- Sem hashtags no texto
- NÃO invente dados ou estatísticas sem fonte`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterApiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://aria-api.onrender.com',
      'X-Title': 'Aria Weekly Batch',
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-v3.2',
      temperature: 0.7,
      messages: [
        { role: 'system', content: 'Você é uma API JSON estrita. Responda APENAS com JSON válido, sem markdown, sem texto extra.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw = data.choices?.[0]?.message?.content ?? '';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`LLM não retornou JSON válido para o tópico "${topic}"`);
  }

  const parsed = JSON.parse(jsonMatch[0]) as Partial<ScriptInput>;

  return {
    title: parsed.title ?? topic,
    format: parsed.format ?? 'Carrossel Educativo',
    hook: parsed.hook ?? `Tudo que você precisa saber sobre ${topic}`,
    body: parsed.body ?? topic,
    visual_cues: Array.isArray(parsed.visual_cues) ? parsed.visual_cues : [],
    cta: parsed.cta ?? 'Salve este carrossel para consultar depois!',
  };
}
