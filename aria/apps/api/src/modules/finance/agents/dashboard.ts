import { SheetsService } from '@aria/integrations';
import { getSpreadsheetId } from '../finance.service';
import { SHEET_NAMES } from '../sheets-schema';
import { checkBudgetAlerts } from './budget-planner';
import { db } from '../../../config/db';
import { applyRecurringExpensesForMonth } from './entries';

db.exec(`
  CREATE TABLE IF NOT EXISTS finance_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    tags TEXT DEFAULT ''
  );
`);

export interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  byCategory: Array<{ category: string; spent: number; budgeted: number; percentage: number }>;
  transactions: Array<{ index: number; source: 'local' | 'sheets'; date: string; type: string; category: string; description: string; amount: number }>;
  alerts: Array<{ category: string; percentage: number; level: string; message: string }>;
}

/**
 * Retorna dados estruturados do dashboard sem chamadas LLM — resposta instantânea.
 */
export async function getDashboardData(month?: string): Promise<DashboardData> {
  const spreadsheetId = getSpreadsheetId();
  const targetMonth = month ?? new Date().toISOString().substring(0, 7);
  await applyRecurringExpensesForMonth(targetMonth);

  if (!spreadsheetId) {
    const rows = db.prepare(`
      SELECT id, date, type, category, description, amount
      FROM finance_transactions
      WHERE date LIKE ?
      ORDER BY date DESC, id DESC
    `).all(`${targetMonth}%`) as Array<any>;

    let totalIncome = 0;
    let totalExpenses = 0;
    const spentMap: Record<string, number> = {};
    const transactions = rows.map(row => {
      const amount = Number(row.amount ?? 0);
      const type = String(row.type ?? 'despesa');
      const category = String(row.category ?? 'Outros');
      if (type === 'receita') {
        totalIncome += amount;
      } else {
        totalExpenses += amount;
        spentMap[category] = (spentMap[category] ?? 0) + amount;
      }
      return {
        index: Number(row.id ?? 0),
        source: 'local' as const,
        date: String(row.date ?? ''),
        type,
        category,
        description: String(row.description ?? ''),
        amount,
      };
    });

    const byCategory = Object.entries(spentMap)
      .map(([category, spent]) => ({ category, spent, budgeted: 0, percentage: 0 }))
      .sort((a, b) => b.spent - a.spent);

    return {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      byCategory,
      transactions,
      alerts: [],
    };
  }

  const service = new SheetsService();

  let txData: { values: string[][] };
  let budgetData: { values: string[][] };
  try {
    [txData, budgetData] = await Promise.all([
      service.readRange(spreadsheetId, `${SHEET_NAMES.TRANSACTIONS}!A2:F10000`),
      service.readRange(spreadsheetId, `${SHEET_NAMES.BUDGET}!A2:B100`),
    ]);
  } catch (err) {
    console.warn('[Finance] getDashboardData sheets fallback -> sqlite:', (err as any)?.message ?? err);
    const rows = db.prepare(`
      SELECT id, date, type, category, description, amount
      FROM finance_transactions
      WHERE date LIKE ?
      ORDER BY date DESC, id DESC
    `).all(`${targetMonth}%`) as Array<any>;

    let totalIncome = 0;
    let totalExpenses = 0;
    const spentMap: Record<string, number> = {};
    const transactions = rows.map(row => {
      const amount = Number(row.amount ?? 0);
      const type = String(row.type ?? 'despesa');
      const category = String(row.category ?? 'Outros');
      if (type === 'receita') {
        totalIncome += amount;
      } else {
        totalExpenses += amount;
        spentMap[category] = (spentMap[category] ?? 0) + amount;
      }
      return {
        index: Number(row.id ?? 0),
        source: 'local' as const,
        date: String(row.date ?? ''),
        type,
        category,
        description: String(row.description ?? ''),
        amount,
      };
    });

    const byCategory = Object.entries(spentMap)
      .map(([category, spent]) => ({ category, spent, budgeted: 0, percentage: 0 }))
      .sort((a, b) => b.spent - a.spent);

    return {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      byCategory,
      transactions,
      alerts: [],
    };
  }

  const budgetMap: Record<string, number> = {};
  for (const row of budgetData.values) {
    if (row[0] && row[1]) budgetMap[row[0]] = parseFloat(row[1]) || 0;
  }

  const rows = txData.values.filter(r => r[0]?.startsWith(targetMonth));
  if (rows.length === 0) {
    const localRows = db.prepare(`
      SELECT id, date, type, category, description, amount
      FROM finance_transactions
      WHERE date LIKE ?
      ORDER BY date DESC, id DESC
    `).all(`${targetMonth}%`) as Array<any>;

    let totalIncomeLocal = 0;
    let totalExpensesLocal = 0;
    const spentMapLocal: Record<string, number> = {};
    const localTransactions = localRows.map(row => {
      const amount = Number(row.amount ?? 0);
      const type = String(row.type ?? 'despesa');
      const category = String(row.category ?? 'Outros');
      if (type === 'receita') {
        totalIncomeLocal += amount;
      } else {
        totalExpensesLocal += amount;
        spentMapLocal[category] = (spentMapLocal[category] ?? 0) + amount;
      }

      return {
        index: Number(row.id ?? 0),
        source: 'local' as const,
        date: String(row.date ?? ''),
        type,
        category,
        description: String(row.description ?? ''),
        amount,
      };
    });

    const byCategoryLocal = Object.entries(spentMapLocal)
      .map(([category, spent]) => ({ category, spent, budgeted: budgetMap[category] ?? 0, percentage: 0 }))
      .sort((a, b) => b.spent - a.spent);

    return {
      totalIncome: totalIncomeLocal,
      totalExpenses: totalExpensesLocal,
      netBalance: totalIncomeLocal - totalExpensesLocal,
      byCategory: byCategoryLocal,
      transactions: localTransactions,
      alerts: [],
    };
  }

  let totalIncome = 0;
  let totalExpenses = 0;
  const spentMap: Record<string, number> = {};
  const transactions = txData.values
    .map((row, i) => ({ row, i }))
    .filter(({ row }) => row[0]?.startsWith(targetMonth))
    .map(({ row, i }) => {
    const amount = parseFloat(row[4] ?? '0') || 0;
    const type = row[1] ?? 'despesa';
    const category = row[2] ?? 'Outros';

    if (type === 'receita') {
      totalIncome += amount;
    } else {
      totalExpenses += amount;
      spentMap[category] = (spentMap[category] ?? 0) + amount;
    }

      return {
        index: i, // zero-based a partir de A2 da aba Transações
        source: 'sheets' as const,
        date: row[0] ?? '',
        type,
        category,
        description: row[3] ?? '',
        amount,
      };
    });

  const allCategories = new Set([...Object.keys(budgetMap), ...Object.keys(spentMap)]);
  const byCategory = Array.from(allCategories)
    .map(category => {
      const budgeted = budgetMap[category] ?? 0;
      const spent = spentMap[category] ?? 0;
      return { category, budgeted, spent, percentage: budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0 };
    })
    .sort((a, b) => b.spent - a.spent);

  const alerts = await checkBudgetAlerts(spreadsheetId, targetMonth);

  return {
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
    byCategory,
    transactions: [...transactions].reverse(),
    alerts,
  };
}
