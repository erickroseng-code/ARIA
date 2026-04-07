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
  transactions: Array<{ index: number; source: 'local' | 'sheets'; date: string; type: string; category: string; description: string; amount: number; isEffective: boolean; effectiveAmount?: number | null; isRecurring?: boolean }>;
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

function buildComparison(
  targetMonth: string,
  plannedIncome: number,
  actualIncome: number,
  totalExpenses: number,
): MonthlyPlanComparison {
  const plan = getMonthlyPlanValues(targetMonth);
  const plannedBalance = plannedIncome - plan.plannedExpenses;
  const actualBalance = actualIncome - totalExpenses;
  return {
    month: targetMonth,
    plannedIncome,
    plannedExpenses: plan.plannedExpenses,
    plannedBalance,
    actualIncome,
    actualExpenses: totalExpenses,
    actualBalance,
    incomeDelta: actualIncome - plannedIncome,
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

function buildDashboardFromRows(rows: any[], targetMonth: string): DashboardData {
  let plannedIncome = 0;
  let actualIncome = 0;
  let totalExpenses = 0;
  const spentMap: Record<string, number> = {};
  const transactions = rows.map(row => {
    const amount = Number(row.amount ?? 0);
    const type = String(row.type ?? 'despesa');
    const category = String(row.category ?? 'Outros');
    const tags = String(row.tags ?? '');
    const isEffective = Number(row.isEffective ?? 1) === 1;
    const effectiveAmount = Number(row.effectiveAmount ?? 0);
    const isRecurring = tags === 'recorrente' || tags.startsWith('recorrente:');
    if (type === 'receita') {
      plannedIncome += amount;
      if (isEffective) actualIncome += (effectiveAmount > 0 ? effectiveAmount : amount);
    } else {
      if (isEffective) {
        totalExpenses += amount;
        spentMap[category] = (spentMap[category] ?? 0) + amount;
      }
    }
    return {
      index: Number(row.id ?? 0),
      source: 'local' as const,
      date: String(row.date ?? ''),
      type,
      category,
      description: String(row.description ?? ''),
      amount,
      isEffective,
      effectiveAmount: effectiveAmount > 0 ? effectiveAmount : null,
      isRecurring,
    };
  });

  const byCategory = Object.entries(spentMap)
    .map(([category, spent]) => ({ category, spent, budgeted: 0, percentage: 0 }))
    .sort((a, b) => b.spent - a.spent);

  return {
    totalIncome: actualIncome,
    totalExpenses,
    netBalance: actualIncome - totalExpenses,
    byCategory,
    transactions,
    alerts: [],
    comparison: buildComparison(targetMonth, plannedIncome, actualIncome, totalExpenses),
  };
}

async function buildDashboardFromSheets(rowsSheets: string[][], budgetData: { values: string[][] }, targetMonth: string): Promise<DashboardData> {
  const spreadsheetId = await getSpreadsheetId()!;
  const budgetMap: Record<string, number> = {};
  for (const row of budgetData.values) {
    if (row[0] && row[1]) budgetMap[row[0]] = parseFloat(row[1]) || 0;
  }

  let plannedIncome = 0;
  let actualIncome = 0;
  let totalExpenses = 0;
  const spentMap: Record<string, number> = {};
  const transactions = rowsSheets.map((row, i) => {
    const amount = parseFloat(row[4] ?? '0') || 0;
    const type = row[1] ?? 'despesa';
    const category = row[2] ?? 'Outros';
    const tag = String(row[5] ?? '').toLowerCase();
    const isEffective = tag
      ? (tag === 'efetivado' || tag.startsWith('efetivado:') || tag === '1' || tag === 'true')
      : (type === 'despesa');
    const tagEffectiveAmount = tag.startsWith('efetivado:') ? Number(tag.split(':')[1]) : NaN;
    const effectiveAmount = Number.isFinite(tagEffectiveAmount) && tagEffectiveAmount > 0 ? tagEffectiveAmount : null;
    const isRecurring = tag === 'recorrente' || tag.startsWith('recorrente:');

    if (type === 'receita') {
      plannedIncome += amount;
      if (isEffective) actualIncome += (effectiveAmount ?? amount);
    } else {
      if (isEffective) {
        totalExpenses += amount;
        spentMap[category] = (spentMap[category] ?? 0) + amount;
      }
    }

    return {
      index: i,
      source: 'sheets' as const,
      date: row[0] ?? '',
      type,
      category,
      description: row[3] ?? '',
      amount,
      isEffective,
      effectiveAmount,
      isRecurring,
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

  const alerts = spreadsheetId ? await checkBudgetAlerts(spreadsheetId, targetMonth) : [];

  return {
    totalIncome: actualIncome,
    totalExpenses,
    netBalance: actualIncome - totalExpenses,
    byCategory,
    transactions: [...transactions].reverse(),
    alerts,
    comparison: buildComparison(targetMonth, plannedIncome, actualIncome, totalExpenses),
  };
}

export async function getDashboardData(month?: string): Promise<DashboardData> {
  const useSheets = process.env.FINANCE_USE_SHEETS === 'true';
  const spreadsheetId = useSheets ? await getSpreadsheetId() : null;
  const targetMonth = normalizeMonth(month);
  await applyRecurringExpensesForMonth(targetMonth);

  const rows = db.prepare(`
    SELECT id, date, type, category, description, amount, tags, isEffective, effectiveAmount
    FROM finance_transactions
    WHERE date LIKE ?
    ORDER BY date DESC, id DESC
  `).all(`${targetMonth}%`) as Array<any>;

  if (!useSheets || !spreadsheetId) {
    return buildDashboardFromRows(rows, targetMonth);
  }

  if (rows.length > 0) {
    return buildDashboardFromRows(rows, targetMonth);
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
    console.warn('[Finance] getDashboardData sheets error -> sqlite:', (err as any)?.message ?? err);
    return buildDashboardFromRows(rows, targetMonth);
  }

  const rowsSheets = txData.values.filter(r => r[0]?.startsWith(targetMonth));
  return buildDashboardFromSheets(rowsSheets, budgetData, targetMonth);
}
