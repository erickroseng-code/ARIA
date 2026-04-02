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

  CREATE TABLE IF NOT EXISTS finance_monthly_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL UNIQUE,
    plannedIncome REAL DEFAULT 0,
    plannedExpenses REAL DEFAULT 0,
    updatedAt TEXT NOT NULL
  );
`);

export interface MonthlyPlanComparison {
  month: string;
  plannedIncome: number;
  plannedExpenses: number;
  plannedBalance: number;
  actualIncome: number;
  actualExpenses: number;
  actualBalance: number;
  incomeDelta: number;
  expensesDelta: number;
  balanceDelta: number;
}

export interface DashboardData {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  byCategory: Array<{ category: string; spent: number; budgeted: number; percentage: number }>;
  transactions: Array<{ index: number; source: 'local' | 'sheets'; date: string; type: string; category: string; description: string; amount: number }>;
  alerts: Array<{ category: string; percentage: number; level: string; message: string }>;
  comparison: MonthlyPlanComparison;
}

export interface MonthlyPlanInput {
  month?: string;
  plannedIncome?: number;
  plannedExpenses?: number;
}

function normalizeMonth(month?: string): string {
  return month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().substring(0, 7);
}

function ensureMonthlyPlanTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS finance_monthly_plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL UNIQUE,
      plannedIncome REAL DEFAULT 0,
      plannedExpenses REAL DEFAULT 0,
      updatedAt TEXT NOT NULL
    );
  `);
}

function getMonthlyPlanValues(month?: string): { month: string; plannedIncome: number; plannedExpenses: number } {
  ensureMonthlyPlanTable();
  const targetMonth = normalizeMonth(month);
  const row = db.prepare(`
    SELECT plannedIncome, plannedExpenses
    FROM finance_monthly_plan
    WHERE month = ?
    LIMIT 1
  `).get(targetMonth) as any;

  return {
    month: targetMonth,
    plannedIncome: Number(row?.plannedIncome ?? 0),
    plannedExpenses: Number(row?.plannedExpenses ?? 0),
  };
}

function buildComparison(targetMonth: string, totalIncome: number, totalExpenses: number): MonthlyPlanComparison {
  const plan = getMonthlyPlanValues(targetMonth);
  const plannedBalance = plan.plannedIncome - plan.plannedExpenses;
  const actualBalance = totalIncome - totalExpenses;
  return {
    month: targetMonth,
    plannedIncome: plan.plannedIncome,
    plannedExpenses: plan.plannedExpenses,
    plannedBalance,
    actualIncome: totalIncome,
    actualExpenses: totalExpenses,
    actualBalance,
    incomeDelta: totalIncome - plan.plannedIncome,
    expensesDelta: totalExpenses - plan.plannedExpenses,
    balanceDelta: actualBalance - plannedBalance,
  };
}

export async function getMonthlyPlan(month?: string): Promise<{ month: string; plannedIncome: number; plannedExpenses: number }> {
  return getMonthlyPlanValues(month);
}

export async function upsertMonthlyPlan(input: MonthlyPlanInput): Promise<{ month: string; plannedIncome: number; plannedExpenses: number }> {
  ensureMonthlyPlanTable();
  const month = normalizeMonth(input.month);
  const plannedIncome = Math.max(0, Number(input.plannedIncome ?? 0));
  const plannedExpenses = Math.max(0, Number(input.plannedExpenses ?? 0));
  const updatedAt = new Date().toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO finance_monthly_plan (month, plannedIncome, plannedExpenses, updatedAt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(month) DO UPDATE SET
      plannedIncome = excluded.plannedIncome,
      plannedExpenses = excluded.plannedExpenses,
      updatedAt = excluded.updatedAt
  `).run(month, plannedIncome, plannedExpenses, updatedAt);

  return { month, plannedIncome, plannedExpenses };
}

/**
 * Retorna dados estruturados do dashboard sem chamadas LLM — resposta instantânea.
 */
export async function getDashboardData(month?: string): Promise<DashboardData> {
  const spreadsheetId = getSpreadsheetId();
  const targetMonth = normalizeMonth(month);
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
      comparison: buildComparison(targetMonth, totalIncome, totalExpenses),
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
      comparison: buildComparison(targetMonth, totalIncome, totalExpenses),
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
      comparison: buildComparison(targetMonth, totalIncomeLocal, totalExpensesLocal),
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
    comparison: buildComparison(targetMonth, totalIncome, totalExpenses),
  };
}
