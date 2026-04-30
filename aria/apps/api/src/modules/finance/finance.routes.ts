import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { processFinanceMessage } from './agents/orchestrator';
import { generateReportPdf } from './agents/pdf-generator';
import { generateReportData } from './agents/report-generator';
import { getDashboardData, getMonthlyPlan, upsertMonthlyPlan } from './agents/dashboard';
import { setupSpreadsheet, getSpreadsheetId, getSpreadsheetUrl, saveSpreadsheetId } from './finance.service';
import {
  addTransactionDirect, updateTransactionDirect, deleteTransactionDirect, addDebt, deleteDebt, getDebts,
  updateTransactionEffectiveDirect,
  addOverdueAccount, deleteOverdueAccount, getOverdueAccounts,
  addRecurringExpense, deleteRecurringExpense, getRecurringExpenses, updateRecurringExpense,
  applyRecurringExpensesForMonth, undoPayOverdue,
  payDebt, payOverdue, payOverdueAccountPartially,
  getCreditCards, addCreditCard, deleteCreditCard,
} from './agents/entries';

export async function registerFinanceRoutes(fastify: FastifyInstance) {
  // GET /api/finance/debug — Debug endpoint
  fastify.get('/debug', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { getSupabase } = await import('../../config/supabase.js');
      const supabase = getSupabase();

      const { data, error } = await supabase.from('transactions').select('count', { count: 'exact' });

      return reply.send({
        supabase: {
          url: process.env.SUPABASE_URL,
          hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          error: error?.message,
          count: (data as any)?.count || data?.length || 0
        },
        cwd: process.cwd(),
        env: {
          FINANCE_USE_SHEETS: process.env.FINANCE_USE_SHEETS,
          NODE_ENV: process.env.NODE_ENV
        }
      });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/finance/setup — Cria planilha no Google Drive
  fastify.post('/setup', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const existing = await getSpreadsheetId();
      if (existing) {
        const url = await getSpreadsheetUrl();
        return reply.send({ success: true, spreadsheetId: existing, spreadsheetUrl: url, message: 'Planilha já configurada.' });
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
    req: FastifyRequest<{ Body: { type: string; category: string; description: string; amount: number; isEffective?: boolean; date?: string; paymentMethod?: string; creditCardId?: number | null } }>,
    reply: FastifyReply,
  ) => {
    try {
      const { type, category, description, amount, isEffective, date, paymentMethod, creditCardId } = req.body;
      if (!type || !category || !description || !amount) {
        return reply.status(400).send({ error: 'Campos obrigatórios: type, category, description, amount' });
      }
      await addTransactionDirect({ type: type as 'receita' | 'despesa', category, description, amount, isEffective, date, paymentMethod, creditCardId });
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // PUT /api/finance/transaction/:index — Alterar receita/despesa
  fastify.put('/transaction/:index', async (
    req: FastifyRequest<{
      Params: { index: string };
      Querystring: { source?: 'local' | 'sheets' | 'supabase' };
      Body: { type: string; category: string; description: string; amount: number; isEffective?: boolean; date?: string };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const rawIndex = req.params.index;
      const source = req.query.source ?? (rawIndex.includes('-') ? 'supabase' : 'local');
      const index = source === 'supabase' ? rawIndex : parseInt(rawIndex, 10);
      const { type, category, description, amount, isEffective, date } = req.body;
      if (source !== 'supabase' && Number.isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      if (!type || !category || !description || !amount) {
        return reply.status(400).send({ error: 'Campos obrigatórios: type, category, description, amount' });
      }
      await updateTransactionDirect(index, {
        type: type as 'receita' | 'despesa',
        category,
        description,
        amount,
        isEffective,
        date,
      }, source);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // PATCH /api/finance/transaction/:index/effective — Efetivar/voltar para previsto
  fastify.patch('/transaction/:index/effective', async (
    req: FastifyRequest<{
      Params: { index: string };
      Querystring: { source?: 'local' | 'sheets' | 'supabase' };
      Body: { isEffective: boolean; actualAmount?: number };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const rawIndex = req.params.index;
      const source = req.query.source ?? (rawIndex.includes('-') ? 'supabase' : 'local');
      const index = source === 'supabase' ? rawIndex : parseInt(rawIndex, 10);
      const { isEffective, actualAmount } = req.body ?? {};
      if (source !== 'supabase' && Number.isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      if (typeof isEffective !== 'boolean') return reply.status(400).send({ error: 'isEffective obrigatório (boolean)' });
      if (actualAmount !== undefined && (!Number.isFinite(Number(actualAmount)) || Number(actualAmount) <= 0)) {
        return reply.status(400).send({ error: 'actualAmount inválido' });
      }
      await updateTransactionEffectiveDirect(index, isEffective, actualAmount !== undefined ? Number(actualAmount) : undefined, source);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // PUT /api/finance/transaction/:index/effective — Efetivar/voltar para previsto
  fastify.put('/transaction/:index/effective', async (
    req: FastifyRequest<{
      Params: { index: string };
      Querystring: { source?: 'local' | 'sheets' | 'supabase' };
      Body: { isEffective: boolean; actualAmount?: number };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const rawIndex = req.params.index;
      const source = req.query.source ?? (rawIndex.includes('-') ? 'supabase' : 'local');
      const index = source === 'supabase' ? rawIndex : parseInt(rawIndex, 10);
      const { isEffective, actualAmount } = req.body ?? {};
      if (source !== 'supabase' && Number.isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      if (typeof isEffective !== 'boolean') return reply.status(400).send({ error: 'isEffective obrigatório (boolean)' });
      if (actualAmount !== undefined && (!Number.isFinite(Number(actualAmount)) || Number(actualAmount) <= 0)) {
        return reply.status(400).send({ error: 'actualAmount inválido' });
      }
      await updateTransactionEffectiveDirect(index, isEffective, actualAmount !== undefined ? Number(actualAmount) : undefined, source);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // DELETE /api/finance/transaction/:index — Remover receita/despesa
  fastify.delete('/transaction/:index', async (
    req: FastifyRequest<{ Params: { index: string }; Querystring: { source?: 'local' | 'sheets' | 'supabase' } }>,
    reply: FastifyReply,
  ) => {
    try {
      const rawIndex = req.params.index;
      const source = req.query.source ?? (rawIndex.includes('-') ? 'supabase' : 'local');
      const index = source === 'supabase' ? rawIndex : parseInt(rawIndex, 10);
      if (source !== 'supabase' && Number.isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      await deleteTransactionDirect(index, source);
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

  fastify.get('/overdue', async (
    req: FastifyRequest<{ Querystring: { month?: string } }>,
    reply: FastifyReply,
  ) => {
    try {
      const month = req.query?.month;
      const accounts = await getOverdueAccounts(month);
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
    req: FastifyRequest<{ Params: { index: string }; Querystring: { source?: 'local' | 'sheets' | 'supabase' } }>,
    reply: FastifyReply,
  ) => {
    try {
      const rawIndex = req.params.index;
      const source = req.query.source ?? (rawIndex.includes('-') ? 'supabase' : 'local');
      const index = source === 'supabase' ? rawIndex : parseInt(rawIndex, 10);
      if (source !== 'supabase' && Number.isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      await deleteOverdueAccount(index, source);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // GET /api/finance/spreadsheet — URL da planilha no Google Drive
  fastify.post('/overdue/:index/pay', async (
    req: FastifyRequest<{
      Params: { index: string };
      Querystring: { source?: 'local' | 'sheets' | 'supabase' };
      Body: { amount: number };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const rawIndex = req.params.index;
      const source = req.query.source ?? (rawIndex.includes('-') ? 'supabase' : 'local');
      const index = source === 'supabase' ? rawIndex : parseInt(rawIndex, 10);
      if (source !== 'supabase' && Number.isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      if (!req.body?.amount || req.body.amount <= 0) return reply.status(400).send({ error: 'amount inválido' });
      await payOverdue(index, source, 'partial', req.body.amount);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.post('/overdue/:index/pay-full', async (
    req: FastifyRequest<{ Params: { index: string }; Querystring: { source?: 'local' | 'sheets' | 'supabase' } }>,
    reply: FastifyReply,
  ) => {
    try {
      const rawIndex = req.params.index;
      const source = req.query.source ?? (rawIndex.includes('-') ? 'supabase' : 'local');
      const index = source === 'supabase' ? rawIndex : parseInt(rawIndex, 10);
      if (source !== 'supabase' && Number.isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      await payOverdue(index, source, 'full');
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/finance/overdue/:index/undo-pay — Desfazer pagamento de conta atrasada
  fastify.post('/overdue/:index/undo-pay', async (
    req: FastifyRequest<{ Params: { index: string }; Querystring: { source?: 'local' | 'sheets' | 'supabase' } }>,
    reply: FastifyReply,
  ) => {
    try {
      const rawIndex = req.params.index;
      const source = req.query.source ?? (rawIndex.includes('-') ? 'supabase' : 'local');
      const index = source === 'supabase' ? rawIndex : parseInt(rawIndex, 10);
      if (source !== 'supabase' && Number.isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      await undoPayOverdue(index, source);
      return reply.send({ success: true });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // POST /api/finance/overdue/:index/pay-partial-tracked — Pagar parcial com saldo rastreado
  fastify.post('/overdue/:index/pay-partial-tracked', async (
    req: FastifyRequest<{
      Params: { index: string };
      Body: { amount: number; paymentDate?: string };
    }>,
    reply: FastifyReply,
  ) => {
    try {
      const index = parseInt(req.params.index, 10);
      if (Number.isNaN(index)) return reply.status(400).send({ error: 'index inválido' });
      if (!req.body?.amount || req.body.amount <= 0) return reply.status(400).send({ error: 'amount inválido' });

      const result = await payOverdueAccountPartially(index, req.body.amount, req.body.paymentDate);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  fastify.get('/spreadsheet', async (_req: FastifyRequest, reply: FastifyReply) => {
    const spreadsheetUrl = await getSpreadsheetUrl();
    if (!spreadsheetUrl) {
      return reply.status(404).send({ error: 'Planilha não configurada.' });
    }
    return reply.send({ spreadsheetUrl });
  });

  fastify.delete('/spreadsheet', async (_req: FastifyRequest, reply: FastifyReply) => {
    await saveSpreadsheetId('');
    return reply.send({ success: true, message: 'Planilha removida. Usando banco local.' });
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
      // Materializa imediatamente o mês de início para evitar duplicação com lançamento manual
      const targetMonth = startMonth ?? new Date().toISOString().slice(0, 7);
      await applyRecurringExpensesForMonth(targetMonth);
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

  // POST /api/finance/migrate-auto — Executar migração completa (auto-descobrindo dados)
  fastify.post('/migrate-auto', async (_req: FastifyRequest, reply: FastifyReply) => {
    try {
      const path = require('path');
      const fs = require('fs');
      const { db } = await import('../../config/db.js');
      const { getSupabase } = await import('../../config/supabase.js');

      const dbPath = process.env.SQLITE_DB_PATH?.trim()
        ? path.resolve(process.env.SQLITE_DB_PATH)
        : path.resolve(process.cwd(), 'dev.native.db');

      const fileExists = fs.existsSync(dbPath);
      const fileSize = fileExists ? fs.statSync(dbPath).size : 0;

      console.log('[Finance] Starting full auto-migration from SQLite to Supabase...');
      console.log(`[Finance] CWD: ${process.cwd()}`);
      console.log(`[Finance] DB Path: ${dbPath}`);
      console.log(`[Finance] File exists: ${fileExists}, size: ${fileSize} bytes`);

      const supabase = getSupabase();
      let totalMigrated = 0;

      // Migrar transactions
      try {
        const transactions = (db.prepare(`
          SELECT date, type, category, description, amount, tags
          FROM finance_transactions
        `).all() as any[]) || [];

        if (transactions.length > 0) {
          const data = transactions.map(t => ({
            date: t.date,
            type: t.type === 'receita' ? 'income' : 'expense',
            category: t.category,
            description: t.description || '',
            amount: parseFloat(t.amount) || 0,
            tags: t.tags ? t.tags.split(',').map((x: string) => x.trim()).filter(Boolean) : [],
          }));

          console.log(`[Finance] Inserting ${data.length} transactions to Supabase...`);
          const { error, data: insertedData } = await supabase.from('transactions').insert(data);
          if (error) {
            console.error('[Finance] Supabase insert error:', {
              code: error.code,
              message: error.message,
              details: (error as any).details,
              hint: (error as any).hint,
            });
            throw error;
          }
          console.log(`[Finance] Successfully inserted, returned:`, insertedData);
          totalMigrated += data.length;
          console.log(`[Finance] Migrated ${data.length} transactions`);
        }
      } catch (err: any) {
        console.warn('[Finance] Transaction migration error:', {
          message: err.message,
          name: err.name,
          code: err.code,
          statusCode: err.statusCode,
        });
      }

      // Migrar budget
      try {
        const budgets = (db.prepare('SELECT category, budgeted FROM finance_budgets').all() as any[]) || [];

        if (budgets.length > 0) {
          const data = budgets.map(b => ({
            category: b.category,
            monthly_budget: parseFloat(b.budgeted) || 0,
          }));

          const { error } = await supabase.from('budget').insert(data);
          if (error) throw error;
          totalMigrated += data.length;
          console.log(`[Finance] Migrated ${data.length} budgets`);
        }
      } catch (err: any) {
        console.warn('[Finance] Budget migration error:', err.message);
      }

      // Migrar settings
      try {
        const settings = (db.prepare('SELECT key, value FROM settings').all() as any[]) || [];

        if (settings.length > 0) {
          const { error } = await supabase.from('settings').insert(
            settings.map(s => ({ key: s.key, value: s.value }))
          );
          if (error) throw error;
          totalMigrated += settings.length;
          console.log(`[Finance] Migrated ${settings.length} settings`);
        }
      } catch (err: any) {
        console.warn('[Finance] Settings migration error:', err.message);
      }

      return reply.send({
        success: true,
        message: `Full migration complete: ${totalMigrated} records migrated`,
        totalMigrated,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error('[Finance] Migration error:', err);
      return reply.status(500).send({ error: err.message ?? 'Migration failed' });
    }
  });

  // POST /api/finance/migrate — Migrar dados do SQLite para Supabase
  fastify.post('/migrate', async (
    req: FastifyRequest<{ Body?: { transactions?: any[] } }>,
    reply: FastifyReply
  ) => {
    try {
      const { getSupabase } = await import('../../config/supabase.js');
      const supabase = getSupabase();
      let migratedCount = 0;

      // Se dados foram enviados no POST, usar esses
      if (req.body?.transactions && Array.isArray(req.body.transactions)) {
        console.log(`[Finance] Inserting ${req.body.transactions.length} transactions via POST...`);
        const { error, data: insertedData } = await supabase.from('transactions').insert(req.body.transactions);
        if (error) {
          console.error('[Finance] Supabase insert error:', {
            code: error.code,
            message: error.message,
            details: (error as any).details,
            hint: (error as any).hint,
          });
          throw error;
        }
        console.log(`[Finance] Successfully inserted ${req.body.transactions.length} transactions`);
        migratedCount = req.body.transactions.length;
      } else {
        // Senão, tentar ler do SQLite local (que pode não estar disponível no Render)
        try {
          const { db } = await import('../../config/db.js');
          console.log('[Finance] Starting migration from SQLite to Supabase...');

          const transactions = (db.prepare(`
            SELECT date, type, category, description, amount, tags
            FROM finance_transactions
          `).all() as any[]) || [];

          if (transactions.length > 0) {
            const data = transactions.map(t => ({
              date: t.date,
              type: t.type === 'receita' ? 'income' : 'expense',
              category: t.category,
              description: t.description || '',
              amount: parseFloat(t.amount) || 0,
              tags: t.tags ? t.tags.split(',').map((x: string) => x.trim()).filter(Boolean) : [],
            }));

            console.log(`[Finance] Inserting ${data.length} transactions to Supabase...`);
            const { error, data: insertedData } = await supabase.from('transactions').insert(data);
            if (error) {
              console.error('[Finance] Supabase insert error:', {
                code: error.code,
                message: error.message,
                details: (error as any).details,
                hint: (error as any).hint,
              });
              throw error;
            }
            console.log(`[Finance] Successfully inserted ${data.length} transactions`);
            migratedCount += data.length;
            console.log(`[Finance] Migrated ${data.length} transactions`);
          }
        } catch (err: any) {
          console.warn('[Finance] SQLite migration error:', {
            message: err.message,
            code: err.code,
          });
          return reply.status(400).send({
            success: false,
            message: 'No data provided in POST body. Send JSON array of transactions.',
            migratedCount: 0
          });
        }
      }

      return reply.send({
        success: true,
        message: `Migration complete: ${migratedCount} records migrated`,
        migratedCount
      });
    } catch (err: any) {
      console.error('[Finance] Migration error:', {
        message: err.message,
        name: err.name,
        statusCode: err.statusCode,
      });
      return reply.status(500).send({ error: err.message ?? 'Migration failed' });
    }
  });
}
