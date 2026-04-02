import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { processFinanceMessage } from './agents/orchestrator';
import { generateReportPdf } from './agents/pdf-generator';
import { generateReportData } from './agents/report-generator';
import { getDashboardData, getMonthlyPlan, upsertMonthlyPlan } from './agents/dashboard';
import { setupSpreadsheet, getSpreadsheetId, getSpreadsheetUrl } from './finance.service';
import {
  addTransactionDirect, updateTransactionDirect, deleteTransactionDirect, addDebt, deleteDebt, getDebts,
  addOverdueAccount, deleteOverdueAccount, getOverdueAccounts,
  addRecurringExpense, deleteRecurringExpense, getRecurringExpenses, updateRecurringExpense,
  payDebt, payOverdue,
  getCreditCards, addCreditCard, deleteCreditCard,
} from './agents/entries';

export async function registerFinanceRoutes(fastify: FastifyInstance) {
  // POST /api/finance/setup — Cria planilha no Google Drive
  fastify.post('/setup', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const existing = getSpreadsheetId();
      if (existing) {
        return reply.send({ success: true, spreadsheetId: existing, spreadsheetUrl: getSpreadsheetUrl(), message: 'Planilha já configurada.' });
      }
      const { spreadsheetId, spreadsheetUrl } = await setupSpreadsheet();
      return reply.send({ success: true, spreadsheetId, spreadsheetUrl });
    } catch (err: any) {
      console.error('[Finance] /setup error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao criar planilha.' });
    }
  });

  // GET /api/finance/dashboard?month=YYYY-MM — Dados estruturados do dashboard (sem LLM)
  fastify.get('/dashboard', async (
    req: FastifyRequest<{ Querystring: { month?: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const data = await getDashboardData(req.query.month);
      return reply.send(data);
    } catch (err: any) {
      console.error('[Finance] /dashboard error:', err);
      return reply.status(500).send({ error: err.message ?? 'Erro ao carregar dashboard.' });
    }
  });

  // GET /api/finance/monthly-plan?month=YYYY-MM — Previsto mensal (receitas/despesas)
  fastify.get('/monthly-plan', async (
    req: FastifyRequest<{ Querystring: { month?: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const plan = await getMonthlyPlan(req.query.month);
      return reply.send(plan);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message ?? 'Erro ao carregar previsto mensal.' });
    }
  });

  // PUT /api/finance/monthly-plan — Salvar previsto mensal
  fastify.put('/monthly-plan', async (
    req: FastifyRequest<{ Body: { month?: string; plannedIncome?: number; plannedExpenses?: number } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { month, plannedIncome, plannedExpenses } = req.body ?? {};
      const plan = await upsertMonthlyPlan({ month, plannedIncome, plannedExpenses });
      return reply.send({ success: true, plan });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message ?? 'Erro ao salvar previsto mensal.' });
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

  // POST /api/finance/transaction — Adicionar receita ou despesa diretamente
  fastify.post('/transaction', async (
    req: FastifyRequest<{ Body: { type: string; category: string; description: string; amount: number; date?: string; paymentMethod?: string; creditCardId?: number | null } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { type, category, description, amount, date, paymentMethod, creditCardId } = req.body;
      if (!type || !category || !description || !amount) {
        return reply.status(400).send({ error: 'Campos obrigatórios: type, category, description, amount' });
      }
      await addTransactionDirect({ type: type as 'receita' | 'despesa', category, description, amount, date, paymentMethod, creditCardId });
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // PUT /api/finance/transaction/:index — Alterar receita/despesa
  fastify.put('/transaction/:index', async (
    req: FastifyRequest<{
      Params: { index: string };
      Querystring: { source?: 'local' | 'sheets' };
      Body: { type: string; category: string; description: string; amount: number; date?: string };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const index = parseInt(req.params.index);
      const { type, category, description, amount, date } = req.body;
      if (isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      if (!type || !category || !description || !amount) {
        return reply.status(400).send({ error: 'Campos obrigatórios: type, category, description, amount' });
      }
      await updateTransactionDirect(index, {
        type: type as 'receita' | 'despesa',
        category,
        description,
        amount,
        date,
      }, req.query.source ?? 'local');
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // DELETE /api/finance/transaction/:index — Remover receita/despesa
  fastify.delete('/transaction/:index', async (
    req: FastifyRequest<{ Params: { index: string }; Querystring: { source?: 'local' | 'sheets' } }>,
    reply: FastifyReply,
  ) => {
    try {
      const index = parseInt(req.params.index);
      if (isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      await deleteTransactionDirect(index, req.query.source ?? 'local');
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/finance/debts — Listar dívidas
  fastify.get('/debts', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const debts = await getDebts();
      return reply.send({ debts });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/finance/debts — Adicionar dívida
  fastify.post('/debts', async (
    req: FastifyRequest<{ Body: { creditor: string; totalAmount: number; interestRate?: number; remainingInstallments?: number; dueDay?: number; dueDate?: string; monthlyInstallment?: number } }>,
    reply: FastifyReply,
  ) => {
    try {
      await addDebt(req.body);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // DELETE /api/finance/debts/:index — Remover dívida por índice
  fastify.delete('/debts/:index', async (
    req: FastifyRequest<{ Params: { index: string }; Querystring: { source?: 'local' | 'sheets' } }>,
    reply: FastifyReply,
  ) => {
    try {
      await deleteDebt(parseInt(req.params.index), req.query.source ?? 'local');
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/finance/overdue — Listar contas atrasadas
  fastify.post('/debts/:index/pay-installment', async (
    req: FastifyRequest<{
      Params: { index: string };
      Querystring: { source?: 'local' | 'sheets' };
      Body: { amount?: number };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const index = parseInt(req.params.index);
      if (isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      await payDebt(index, req.query.source ?? 'local', 'installment', req.body?.amount);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post('/debts/:index/pay-full', async (
    req: FastifyRequest<{ Params: { index: string }; Querystring: { source?: 'local' | 'sheets' } }>,
    reply: FastifyReply,
  ) => {
    try {
      const index = parseInt(req.params.index);
      if (isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      await payDebt(index, req.query.source ?? 'local', 'full');
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.get('/overdue', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const accounts = await getOverdueAccounts();
      return reply.send({ accounts });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/finance/overdue — Adicionar conta atrasada
  fastify.post('/overdue', async (
    req: FastifyRequest<{ Body: { account: string; overdueAmount: number; daysOverdue?: number; dueDate?: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      await addOverdueAccount(req.body);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // DELETE /api/finance/overdue/:index — Remover conta atrasada
  fastify.delete('/overdue/:index', async (
    req: FastifyRequest<{ Params: { index: string }; Querystring: { source?: 'local' | 'sheets' } }>,
    reply: FastifyReply,
  ) => {
    try {
      await deleteOverdueAccount(parseInt(req.params.index), req.query.source ?? 'local');
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/finance/spreadsheet — URL da planilha no Google Drive
  fastify.post('/overdue/:index/pay', async (
    req: FastifyRequest<{
      Params: { index: string };
      Querystring: { source?: 'local' | 'sheets' };
      Body: { amount: number };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const index = parseInt(req.params.index);
      if (isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      if (!req.body?.amount || req.body.amount <= 0) return reply.status(400).send({ error: 'amount inválido' });
      await payOverdue(index, req.query.source ?? 'local', 'partial', req.body.amount);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post('/overdue/:index/pay-full', async (
    req: FastifyRequest<{ Params: { index: string }; Querystring: { source?: 'local' | 'sheets' } }>,
    reply: FastifyReply,
  ) => {
    try {
      const index = parseInt(req.params.index);
      if (isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      await payOverdue(index, req.query.source ?? 'local', 'full');
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.get('/spreadsheet', async (_req: FastifyRequest, reply: FastifyReply) => {
    const spreadsheetUrl = getSpreadsheetUrl();
    if (!spreadsheetUrl) {
      return reply.status(404).send({ error: 'Planilha não configurada.' });
    }
    return reply.send({ spreadsheetUrl });
  });

  // GET /api/finance/recurring-expenses — Listar despesas fixas mensais
  fastify.get('/recurring-expenses', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const recurring = await getRecurringExpenses();
      return reply.send({ recurring });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/finance/recurring-expenses — Cadastrar despesa fixa mensal
  fastify.post('/recurring-expenses', async (
    req: FastifyRequest<{ Body: { description: string; category: string; amount: number; dayOfMonth: number; startMonth?: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { description, category, amount, dayOfMonth, startMonth } = req.body;
      if (!description || !category || !amount || !dayOfMonth) {
        return reply.status(400).send({ error: 'Campos obrigatórios: description, category, amount, dayOfMonth' });
      }
      await addRecurringExpense({ description, category, amount, dayOfMonth, startMonth });
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // PUT /api/finance/recurring-expenses/:id — Atualizar despesa fixa mensal
  fastify.put('/recurring-expenses/:id', async (
    req: FastifyRequest<{ Params: { id: string }; Body: { description?: string; category?: string; amount?: number; dayOfMonth?: number; startMonth?: string; active?: boolean } }>,
    reply: FastifyReply,
  ) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: 'id inválido' });
      await updateRecurringExpense(id, req.body);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // DELETE /api/finance/recurring-expenses/:id — Remover despesa fixa mensal
  fastify.delete('/recurring-expenses/:id', async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: 'id inválido' });
      await deleteRecurringExpense(id);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/finance/credit-cards
  fastify.get('/credit-cards', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const cards = await getCreditCards();
      return reply.send({ cards });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/finance/credit-cards
  fastify.post('/credit-cards', async (
    req: FastifyRequest<{ Body: { name: string; bank: string; brand?: string; closingDay: number; dueDay: number; cardLimit?: number } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { name, bank, brand, closingDay, dueDay, cardLimit } = req.body;
      if (!name || !bank || !closingDay || !dueDay) {
        return reply.status(400).send({ error: 'Campos obrigatórios: name, bank, closingDay, dueDay' });
      }
      await addCreditCard({ name, bank, brand, closingDay, dueDay, cardLimit });
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // DELETE /api/finance/credit-cards/:id
  fastify.delete('/credit-cards/:id', async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return reply.status(400).send({ error: 'id inválido' });
      await deleteCreditCard(id);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
}
