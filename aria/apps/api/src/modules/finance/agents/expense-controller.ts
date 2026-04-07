import { llmChat } from './llm-client';
import { SheetsService } from '@aria/integrations';
import { getSpreadsheetId } from '../finance.service';
import { SHEET_NAMES } from '../sheets-schema';
import { checkBudgetAlerts } from './budget-planner';
import { addTransactionDirect } from './entries';
import { getDashboardData } from './dashboard';


interface TransactionExtraction {
  date: string;
  type: 'receita' | 'despesa';
  category: string;
  description: string;
  amount: number;
  tags: string;
}

function extractJson<T>(raw: string): T {
  const text = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(text) as T; } catch { /* continue */ }
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]) as T; } catch { /* continue */ } }
  throw new Error('JSON inválido na extração de transação');
}

/**
 * Extrai dados de uma transação a partir de linguagem natural e registra na planilha.
 */
export async function recordTransaction(userMessage: string): Promise<{
  reply: string;
  alerts: Array<{ category: string; percentage: number; level: string; message: string }>;
}> {
  const spreadsheetId = await getSpreadsheetId();

  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.substring(0, 7);

  const systemPrompt = `Você é uma API JSON para extração de transações financeiras. Responda APENAS com JSON.`;
  const userPrompt = `Extraia os dados da transação desta mensagem: "${userMessage}"

Data padrão se não informada: ${today}
Categorias de despesa: Alimentação, Moradia, Transporte, Saúde, Lazer, Educação, Vestuário, Tecnologia, Assinaturas, Outros
Categorias de receita: Salário, Freelance, Investimentos, Aluguel Recebido, Outros

JSON:
{
  "date": "YYYY-MM-DD",
  "type": "receita ou despesa",
  "category": "<categoria>",
  "description": "<descrição curta>",
  "amount": <número positivo>,
  "tags": "<tags separadas por vírgula ou vazio>"
}`;

  const raw = await llmChat(userPrompt, systemPrompt, 0);
  const tx = extractJson<TransactionExtraction>(raw);

  // Registrar na aba Transações quando houver planilha; caso contrário, usa banco local.
  if (spreadsheetId) {
    const service = new SheetsService();
    const row = [tx.date, tx.type, tx.category, tx.description, String(tx.amount), tx.tags];
    await service.appendRows(spreadsheetId, `${SHEET_NAMES.TRANSACTIONS}!A1`, [row]);
  } else {
    await addTransactionDirect({
      type: tx.type,
      category: tx.category,
      description: tx.description,
      amount: tx.amount,
      date: tx.date,
      isEffective: true,
    });
  }

  // Verificar alertas de orçamento (apenas despesas)
  const alerts = spreadsheetId && tx.type === 'despesa'
    ? await checkBudgetAlerts(spreadsheetId, currentMonth)
    : [];

  const typeLabel = tx.type === 'receita' ? '💰 Receita' : '💸 Despesa';
  const formattedAmount = tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const reply = `${typeLabel} registrada!\n\n📅 ${tx.date} | **${tx.category}**\n${tx.description} — ${formattedAmount}`;

  return { reply, alerts };
}

/**
 * Consulta o saldo e resumo do mês atual.
 */
export async function queryBalance(month?: string): Promise<string> {
  const useSheets = process.env.FINANCE_USE_SHEETS === 'true';
  const spreadsheetId = useSheets ? await getSpreadsheetId() : null;

  const targetMonth = month ?? new Date().toISOString().substring(0, 7);
  const monthLabel = new Date(`${targetMonth}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  if (!useSheets || !spreadsheetId) {
    const data = await getDashboardData(targetMonth);
    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const topCategories = data.byCategory
      .slice(0, 3)
      .map((entry) => `  • ${entry.category}: ${fmt(entry.spent)}`)
      .join('\n');

    return `## Resumo — ${monthLabel}\n\n` +
      `💰 **Receitas:** ${fmt(data.totalIncome)}\n` +
      `💸 **Despesas:** ${fmt(data.totalExpenses)}\n` +
      `📊 **Saldo:** ${fmt(data.netBalance)}\n\n` +
      `**Top categorias de gasto:**\n${topCategories || '  Nenhuma despesa ainda'}`;
  }

  const service = new SheetsService();
  const data = await service.readRange(spreadsheetId, `${SHEET_NAMES.TRANSACTIONS}!A2:F10000`);

  if (data.values.length === 0) {
    return `Nenhuma transação registrada para ${monthLabel}.`;
  }

  // Filtrar pelo mês
  const rows = data.values.filter(r => r[0]?.startsWith(targetMonth));
  if (rows.length === 0) {
    return `Nenhuma transação encontrada para ${monthLabel}.`;
  }

  let totalReceita = 0;
  let totalDespesa = 0;
  const byCategory: Record<string, number> = {};

  for (const row of rows) {
    const type = row[1];
    const category = row[2] ?? 'Outros';
    const amount = parseFloat(row[4] ?? '0') || 0;
    if (type === 'receita') {
      totalReceita += amount;
    } else {
      totalDespesa += amount;
      byCategory[category] = (byCategory[category] ?? 0) + amount;
    }
  }

  const saldo = totalReceita - totalDespesa;
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat, val]) => `  • ${cat}: ${fmt(val)}`)
    .join('\n');

  return `## Resumo — ${monthLabel}\n\n` +
    `💰 **Receitas:** ${fmt(totalReceita)}\n` +
    `💸 **Despesas:** ${fmt(totalDespesa)}\n` +
    `📊 **Saldo:** ${fmt(saldo)}\n\n` +
    `**Top categorias de gasto:**\n${topCategories || '  Nenhuma despesa ainda'}`;
}

/**
 * Lista as transações do mês com filtros opcionais.
 */
export async function queryTransactions(month?: string, category?: string): Promise<string> {
  const spreadsheetId = await getSpreadsheetId();

  const targetMonth = month ?? new Date().toISOString().substring(0, 7);
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (!spreadsheetId) {
    const data = await getDashboardData(targetMonth);
    let tx = data.transactions;
    if (category) {
      const search = category.toLowerCase();
      tx = tx.filter((t) => (t.category ?? '').toLowerCase().includes(search));
    }
    if (tx.length === 0) return 'Nenhuma transação encontrada.';

    const lines = tx.slice(0, 20).map((t) =>
      `${t.date} | ${t.type === 'receita' ? '💰' : '💸'} ${t.category} | ${t.description} | ${fmt(t.amount)}`
    );
    return `**Últimas transações${category ? ` (${category})` : ''}:**\n\n${lines.join('\n')}`;
  }

  const service = new SheetsService();
  const data = await service.readRange(spreadsheetId, `${SHEET_NAMES.TRANSACTIONS}!A2:F10000`);

  let rows = data.values.filter(r => r[0]?.startsWith(targetMonth));
  if (category) rows = rows.filter(r => r[2]?.toLowerCase().includes(category.toLowerCase()));

  if (rows.length === 0) return `Nenhuma transação encontrada.`;

  const lines = rows.slice(-20).map(r =>
    `${r[0]} | ${r[1] === 'receita' ? '💰' : '💸'} ${r[2]} | ${r[3]} | ${fmt(parseFloat(r[4] ?? '0'))}`
  );

  return `**Últimas transações${category ? ` (${category})` : ''}:**\n\n${lines.join('\n')}`;
}
