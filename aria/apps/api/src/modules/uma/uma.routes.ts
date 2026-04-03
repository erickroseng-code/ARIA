import fs from 'fs';
import path from 'path';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

const QUEUE_PATH = path.resolve(__dirname, '../../../data/uma-queue.json');

interface Slide {
  type: 'cover' | 'content' | 'cta';
  title: string;
  body: string;
}

interface Carousel {
  title: string;
  theme: 'dark' | 'light';
  slides: Slide[];
}

interface QueueItem {
  id: string;
  createdAt: string;
  description: string;
  carousel: Carousel;
}

function readQueue(): QueueItem[] {
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf-8')) as QueueItem[];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]): void {
  const dir = path.dirname(QUEUE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(items, null, 2), 'utf-8');
}

async function generateCarouselWithLLM(
  description: string,
  style: string,
  audience: string,
): Promise<Carousel> {
  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) throw new Error('GROQ_API_KEY não configurado');

  const systemPrompt = `Você é Uma, uma designer de carrosséis para Instagram especialista em conteúdo viral.
Sua tarefa é criar carrosséis com estrutura otimizada para engajamento: começa com uma capa irresistível,
desenvolve o conteúdo em slides concisos e termina com uma CTA clara.

REGRAS:
- Capa (cover): título impactante, curto, frase de impacto no body
- Conteúdo (content): máximo 2-3 pontos por slide, use números/listas
- CTA (cta): ação clara e direta, sem título necessário
- Total de slides: 5-8 slides (ideal 6-7)
- Textos em português, concisos e diretos
- Use linguagem do público-alvo informado

Retorne APENAS um JSON válido sem markdown, no formato:
{
  "title": "título do carrossel",
  "theme": "dark",
  "slides": [
    {"type": "cover", "title": "Título impactante", "body": "Subtítulo ou frase de gancho"},
    {"type": "content", "title": "Ponto 1", "body": "Explicação concisa"},
    {"type": "cta", "title": "", "body": "Texto da chamada para ação"}
  ]
}`;

  const userPrompt = `Crie um carrossel para Instagram com as seguintes especificações:
- Descrição/Tema: ${description}
- Estilo visual: ${style || 'dark (fundo escuro, texto branco, detalhes vermelhos)'}
- Público-alvo: ${audience || 'empreendedores e criadores de conteúdo'}

Gere slides que sigam a progressão: GANCHO → PROBLEMA → SOLUÇÃO → BENEFÍCIOS → CTA`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error: ${res.status} — ${err}`);
  }

  const data = await res.json() as any;
  const raw = data.choices?.[0]?.message?.content ?? '';

  // Extrai JSON da resposta (remove possível markdown)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM não retornou JSON válido');

  const carousel = JSON.parse(jsonMatch[0]) as Carousel;

  // Valida estrutura mínima
  if (!carousel.slides || !Array.isArray(carousel.slides) || carousel.slides.length === 0) {
    throw new Error('Carousel gerado sem slides');
  }

  return carousel;
}

export async function registerUmaRoutes(fastify: FastifyInstance) {
  // ── POST /api/uma/carousel ─────────────────────────────────────────────────
  // Gera um carrossel a partir de uma descrição em linguagem natural
  fastify.post('/carousel', async (
    req: FastifyRequest<{ Body: { description: string; style?: string; audience?: string } }>,
    reply: FastifyReply,
  ) => {
    const { description, style, audience } = req.body;

    if (!description?.trim()) {
      return reply.status(400).send({ error: 'description é obrigatório' });
    }

    try {
      const carousel = await generateCarouselWithLLM(
        description.trim(),
        style?.trim() ?? '',
        audience?.trim() ?? '',
      );

      // Salva na fila para o Figma plugin
      const items = readQueue();
      const item: QueueItem = {
        id: `uma-${Date.now()}`,
        createdAt: new Date().toISOString(),
        description: description.trim(),
        carousel,
      };
      items.push(item);
      // Mantém no máximo 50 itens na fila
      if (items.length > 50) items.splice(0, items.length - 50);
      writeQueue(items);

      return reply.send({ success: true, item });
    } catch (err: any) {
      console.error('[Uma] /carousel error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao gerar carrossel' });
    }
  });

  // ── GET /api/uma/queue ─────────────────────────────────────────────────────
  // Retorna a fila de carrosséis para o plugin do Figma
  fastify.get('/queue', async (_req: FastifyRequest, reply: FastifyReply) => {
    const items = readQueue();
    return reply.send({ success: true, items });
  });

  // ── DELETE /api/uma/queue/:id ──────────────────────────────────────────────
  // Remove item da fila após o Figma consumir
  fastify.delete('/queue/:id', async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const { id } = req.params;
    const items = readQueue().filter(i => i.id !== id);
    writeQueue(items);
    return reply.send({ success: true });
  });

  // ── GET /api/uma/health ────────────────────────────────────────────────────
  fastify.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: 'ok', squad: 'Uma', role: 'Carousel Designer' });
  });
}
