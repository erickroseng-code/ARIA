import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { processFinanceMessage, getFirstOnboardingMessage } from './agents/orchestrator';
import { generateReportData } from './agents/report-generator';
import { generateReportPdf } from './agents/pdf-generator';
import { checkBudgetAlerts } from './agents/budget-planner';
import { queryBalance } from './agents/expense-controller';
import { setupSpreadsheet, getSpreadsheetId, getSpreadsheetUrl, getOnboardingState } from './finance.service';

export async function registerFinanceRoutes(fastify: FastifyInstance) {
  // POST /api/finance/setup — Cria planilha no Google Drive e inicia onboarding
  fastify.post('/setup', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const existing = getSpreadsheetId();
      if (existing) {
        return reply.send({
          success: true,
          spreadsheetId: existing,
          spreadsheetUrl: getSpreadsheetUrl(),
          message: 'Planilha já configurada.',
        });
      }

      const { spreadsheetId, spreadsheetUrl } = await setupSpreadsheet();
      return reply.send({ success: true, spreadsheetId, spreadsheetUrl });
    } catch (err: any) {
      console.error('[Finance] /setup error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao criar planilha.' });
    }
  });

  // GET /api/finance/status — Estado atual: onboarding completo? planilha configurada?
  fastify.get('/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const onboarding = getOnboardingState();
      const spreadsheetId = getSpreadsheetId();
      const spreadsheetUrl = getSpreadsheetUrl();

      return reply.send({
        onboardingCompleted: onboarding.completed,
        onboardingStep: onboarding.step,
        spreadsheetConfigured: !!spreadsheetId,
        spreadsheetUrl,
        firstMessage: !onboarding.completed ? getFirstOnboardingMessage() : null,
      });
    } catch (err: any) {
      console.error('[Finance] /status error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao obter status.' });
    }
  });

  // POST /api/finance/message — Processar mensagem do usuário (endpoint principal)
  fastify.post('/message', async (
    req: FastifyRequest<{ Body: { message: string } }>,
    reply: FastifyReply,
  ) => {
    const { message } = req.body;
    if (!message?.trim()) {
      return reply.status(400).send({ error: 'message é obrigatório' });
    }

    try {
      const result = await processFinanceMessage(message);
      return reply.send({
        reply: result.reply,
        alerts: result.alerts,
        spreadsheetUrl: result.spreadsheetUrl,
        action: result.action,
      });
    } catch (err: any) {
      console.error('[Finance] /message error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao processar mensagem.' });
    }
  });

  // GET /api/finance/summary — Resumo do mês atual
  fastify.get('/summary', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const summary = await queryBalance();
      return reply.send({ summary });
    } catch (err: any) {
      console.error('[Finance] /summary error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao gerar resumo.' });
    }
  });

  // GET /api/finance/alerts — Alertas de orçamento ativos no mês atual
  fastify.get('/alerts', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const spreadsheetId = getSpreadsheetId();
      if (!spreadsheetId) {
        return reply.send({ alerts: [] });
      }

      const month = new Date().toISOString().slice(0, 7); // YYYY-MM
      const alerts = await checkBudgetAlerts(spreadsheetId, month);
      return reply.send({ alerts });
    } catch (err: any) {
      console.error('[Finance] /alerts error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao verificar alertas.' });
    }
  });

  // GET /api/finance/report/pdf — Baixar relatório em PDF (?month=YYYY-MM)
  fastify.get('/report/pdf', async (
    req: FastifyRequest<{ Querystring: { month?: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const month = req.query.month; // opcional, usa mês atual se não informado
      const reportData = await generateReportData(month);
      const pdfBuffer = await generateReportPdf(reportData);

      const filename = `relatorio-financeiro-${reportData.month}.pdf`;
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.header('Content-Length', pdfBuffer.length.toString());
      return reply.send(pdfBuffer);
    } catch (err: any) {
      console.error('[Finance] /report/pdf error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao gerar PDF.' });
    }
  });

  // GET /api/finance/spreadsheet — URL da planilha no Google Drive
  fastify.get('/spreadsheet', async (_req: FastifyRequest, reply: FastifyReply) => {
    const spreadsheetUrl = getSpreadsheetUrl();
    if (!spreadsheetUrl) {
      return reply.status(404).send({ error: 'Planilha não configurada.' });
    }
    return reply.send({ spreadsheetUrl });
  });
}
