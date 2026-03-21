import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  generateContentPyramid,
  generateIdeaCards,
  generateScript,
  generateDossie,
  generateScriptV2,
  type OnboardingInput,
  type IdeatorInput,
  type GenerateInput,
  type DossieInput,
  type GenerateV2Input,
} from './copywriter.v2.service';

export async function registerMaverickRoutes(fastify: FastifyInstance) {
  // ── POST /api/maverick/onboarding ──────────────────────────────────────────
  // Recebe Nicho + Público e retorna a Pirâmide de Conteúdo (3 Pilares + 5 Micro-Temas cada)
  fastify.post('/onboarding', async (
    req: FastifyRequest<{ Body: OnboardingInput }>,
    reply: FastifyReply,
  ) => {
    const { niche, targetAudience } = req.body;

    if (!niche?.trim() || !targetAudience?.trim()) {
      return reply.status(400).send({ error: 'niche e targetAudience são obrigatórios' });
    }

    try {
      const pyramid = await generateContentPyramid({ niche, targetAudience });
      return reply.send({ success: true, pyramid });
    } catch (err: any) {
      console.error('[Maverick] /onboarding error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao gerar pirâmide de conteúdo' });
    }
  });

  // ── POST /api/maverick/ideator ─────────────────────────────────────────────
  // Recebe Nicho + Público + Tema genérico e retorna 5 Cards de Ângulo ultra-específicos
  fastify.post('/ideator', async (
    req: FastifyRequest<{ Body: IdeatorInput }>,
    reply: FastifyReply,
  ) => {
    const { niche, targetAudience, topic } = req.body;

    if (!niche?.trim() || !topic?.trim()) {
      return reply.status(400).send({ error: 'niche e topic são obrigatórios' });
    }

    try {
      const cards = await generateIdeaCards({ niche, targetAudience: targetAudience ?? '', topic });
      return reply.send({ success: true, cards });
    } catch (err: any) {
      console.error('[Maverick] /ideator error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao gerar ângulos' });
    }
  });

  // ── POST /api/maverick/generate (SSE Streaming) ────────────────────────────
  // Recebe o Ângulo escolhido + Formato e gera a copy final via llama-4-maverick
  fastify.post('/generate', async (
    req: FastifyRequest<{ Body: GenerateInput }>,
    reply: FastifyReply,
  ) => {
    const { niche, targetAudience, angle, hook, format } = req.body;

    if (!niche?.trim() || !angle?.trim() || !format) {
      return reply.status(400).send({ error: 'niche, angle e format são obrigatórios' });
    }

    const validFormats = ['reels', 'carousel', 'sales_page'];
    if (!validFormats.includes(format)) {
      return reply.status(400).send({ error: `format deve ser um de: ${validFormats.join(', ')}` });
    }

    try {
      // Configurar SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no',
      });

      const generator = generateScript({ niche, targetAudience: targetAudience ?? '', angle, hook: hook ?? angle, format });

      for await (const chunk of generator) {
        reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    } catch (err: any) {
      console.error('[Maverick] /generate error:', err);
      if (!reply.raw.headersSent) {
        return reply.status(500).send({ error: err.message ?? 'Erro ao gerar roteiro' });
      }
      reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      reply.raw.end();
    }
  });

  // ── POST /api/maverick/dossie ──────────────────────────────────────────────
  // Recebe modo + respostas de scoping → retorna estratégia + 3 ganchos do brain
  fastify.post('/dossie', async (
    req: FastifyRequest<{ Body: DossieInput }>,
    reply: FastifyReply,
  ) => {
    const { mode, scopingAnswers } = req.body;
    if (!mode || !scopingAnswers) {
      return reply.status(400).send({ error: 'mode e scopingAnswers são obrigatórios' });
    }
    try {
      const dossie = await generateDossie({ mode, scopingAnswers });
      return reply.send({ success: true, dossie });
    } catch (err: any) {
      console.error('[Maverick] /dossie error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao gerar dossiê' });
    }
  });

  // ── POST /api/maverick/generate-v2 (SSE Streaming) ────────────────────────
  // Recebe modo + scopingAnswers + chosenHook → gera copy via llama-4-maverick
  fastify.post('/generate-v2', async (
    req: FastifyRequest<{ Body: GenerateV2Input }>,
    reply: FastifyReply,
  ) => {
    const { mode, scopingAnswers, chosenHook } = req.body;
    if (!mode || !scopingAnswers || !chosenHook?.trim()) {
      return reply.status(400).send({ error: 'mode, scopingAnswers e chosenHook são obrigatórios' });
    }
    try {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no',
      });
      const generator = generateScriptV2({ mode, scopingAnswers, chosenHook });
      for await (const chunk of generator) {
        reply.raw.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    } catch (err: any) {
      console.error('[Maverick] /generate-v2 error:', err);
      if (!reply.raw.headersSent) {
        return reply.status(500).send({ error: err.message ?? 'Erro ao gerar copy' });
      }
      reply.raw.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      reply.raw.end();
    }
  });

  // ── GET /api/maverick/health ───────────────────────────────────────────────
  fastify.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      squad: 'Maverick V2',
      engine: 'meta-llama/llama-4-maverick',
      ideator: 'llama3-8b-8192',
    });
  });
}
