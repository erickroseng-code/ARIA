import { SheetsService } from '@aria/integrations';
import { getSpreadsheetId } from '../finance.service';
import { SHEET_NAMES } from '../sheets-schema';
import { checkBudgetAlerts } from './budget-planner';
import { db } from '../../../config/db';
import { getSupabase } from '../../../config/supabase';
import { applyRecurringExpensesForMonth } from './entries';
const USE_SUPABASE = process.env.FINANCE_USE_SUPABASE === 'true';
const USE_LOCAL_CACHE = process.env.FINANCE_LOCAL_READ_CACHE !== 'false';
const CACHE_REFRESH_MS = Number(process.env.FINANCE_CACHE_REFRESH_MS ?? 60000);
const lastCacheRefreshByMonth = new Map<string, number>();

db.exec(`
  CREATE TABLE IF NOT EXISTS finance_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    remoteId TEXT,
    source TEXT DEFAULT 'local',
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    tags TEXT DEFAULT '',
    isEffective INTEGER DEFAULT 1,
    effectiveAmount REAL DEFAULT NULL
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
  transactions: Array<{ index: number | string; source: 'local' | 'sheets' | 'supabase'; date: string; type: string; category: string; description: string; amount: number; isEffective: boolean; effectiveAmount?: number | null; isRecurring?: boolean }>;
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

function hasColumn(tableName: string, columnName: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some(c => c.name === columnName);
}

function ensureTransactionsCacheSchema(): void {
  if (!hasColumn('finance_transactions', 'remoteId')) {
    db.exec(`ALTER TABLE finance_transactions ADD COLUMN remoteId TEXT DEFAULT NULL`);
  }
  if (!hasColumn('finance_transactions', 'source')) {
    db.exec(`ALTER TABLE finance_transactions ADD COLUMN source TEXT DEFAULT 'local'`);
  }
  if (!hasColumn('finance_transactions', 'isEffective')) {
    db.exec(`ALTER TABLE finance_transactions ADD COLUMN isEffective INTEGER DEFAULT 1`);
  }
  if (!hasColumn('finance_transactions', 'effectiveAmount')) {
    db.exec(`ALTER TABLE finance_transactions ADD COLUMN effectiveAmount REAL DEFAULT NULL`);
  }
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
      index: row.source === 'supabase' ? String(row.remoteId ?? row.id ?? '') : Number(row.id ?? 0),
      source: (row.source ?? 'local') as 'local' | 'sheets' | 'supabase',
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

function buildTransactionSignature(row: any): string {
  const date = String(row.date ?? '').trim();
  const type = String(row.type ?? '').trim();
  const category = String(row.category ?? '').trim().toLowerCase();
  const description = String(row.description ?? '').trim().toLowerCase();
  const amount = Number(row.amount ?? 0).toFixed(2);
  return `${date}|${type}|${category}|${description}|${amount}`;
}

function dedupeLocalRowsWhenSupabaseExists(rows: any[]): any[] {
  const hasSupabaseRows = rows.some((row) => String(row.source ?? '') === 'supabase');
  if (!hasSupabaseRows) return rows;

  const supabaseSignatures = new Set(
    rows
      .filter((row) => String(row.source ?? '') === 'supabase')
      .map(buildTransactionSignature),
  );

  if (supabaseSignatures.size === 0) return rows;

  return rows.filter((row) => {
    const source = String(row.source ?? '');
    if (source === 'supabase') return true;
    return !supabaseSignatures.has(buildTransactionSignature(row));
  });
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

function getMonthDateRange(targetMonth: string): { start: string; end: string } {
  const [year, month] = targetMonth.split('-');
  const monthNum = parseInt(month, 10);

  let nextMonth: string;
  let nextYear: string;
  if (monthNum === 12) {
    nextMonth = '01';
    nextYear = String(parseInt(year, 10) + 1);
  } else {
    nextMonth = String(monthNum + 1).padStart(2, '0');
    nextYear = year;
  }

  return {
    start: `${targetMonth}-01`,
    end: `${nextYear}-${nextMonth}-01`,
  };
}

function mapSupabaseRowsToLocalRows(supabaseRows: any[]): any[] {
  return supabaseRows.map((row: any) => {
    const tagsString = Array.isArray(row.tags) ? row.tags.join(',') : String(row.tags ?? '');
    const hasEffectiveTag = tagsString.includes('efetivado');
    const hasRecurringTag = tagsString.includes('recorrente');
    const isEffective = hasEffectiveTag ? true : (row.type === 'expense' ? !hasRecurringTag : false);
    let effectiveAmount: number | null = null;
    if (isEffective && tagsString.includes('efetivado:')) {
      const match = tagsString.match(/efetivado:([0-9.]+)/);
      if (match && match[1]) {
        effectiveAmount = parseFloat(match[1]);
      }
    }

    return {
      remoteId: String(row.id ?? ''),
      source: 'supabase',
      date: String(row.date ?? ''),
      type: row.type === 'income' ? 'receita' : 'despesa',
      category: String(row.category ?? ''),
      description: String(row.description ?? ''),
      amount: Number(row.amount ?? 0),
      tags: tagsString,
      isEffective: isEffective ? 1 : 0,
      effectiveAmount,
    };
  });
}

function replaceSupabaseMonthCache(targetMonth: string, mappedRows: any[]): void {
  db.prepare(`
    DELETE FROM finance_transactions
    WHERE source = 'supabase'
      AND date LIKE ?
  `).run(`${targetMonth}%`);

  const insert = db.prepare(`
    INSERT INTO finance_transactions (remoteId, source, date, type, category, description, amount, tags, isEffective, effectiveAmount)
    VALUES (?, 'supabase', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of mappedRows) {
    insert.run(
      row.remoteId,
      row.date,
      row.type,
      row.category,
      row.description,
      row.amount,
      row.tags,
      row.isEffective,
      row.effectiveAmount ?? null,
    );
  }
}

async function refreshSupabaseMonthCache(targetMonth: string): Promise<any[]> {
  const supabase = getSupabase();
  const { start, end } = getMonthDateRange(targetMonth);
  const { data: supabaseRows, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', start)
    .lt('date', end);

  if (error) {
    throw new Error(error.message);
  }

  const mappedRows = mapSupabaseRowsToLocalRows(supabaseRows ?? []);
  replaceSupabaseMonthCache(targetMonth, mappedRows);
  lastCacheRefreshByMonth.set(targetMonth, Date.now());
  return mappedRows;
}

export async function getDashboardData(month?: string): Promise<DashboardData> {
  const useSheets = process.env.FINANCE_USE_SHEETS === 'true';
  const spreadsheetId = useSheets ? await getSpreadsheetId() : null;
  const targetMonth = normalizeMonth(month);
  ensureTransactionsCacheSchema();
  await applyRecurringExpensesForMonth(targetMonth);

  let rows: any[] = [];

  if (USE_SUPABASE && USE_LOCAL_CACHE) {
    rows = db.prepare(`
      SELECT id, remoteId, source, date, type, category, description, amount, tags, isEffective, effectiveAmount
      FROM finance_transactions
      WHERE date LIKE ?
      ORDER BY date DESC, id DESC
    `).all(`${targetMonth}%`) as Array<any>;

    rows = dedupeLocalRowsWhenSupabaseExists(rows);

    if (rows.length > 0) {
      const lastRefresh = lastCacheRefreshByMonth.get(targetMonth) ?? 0;
      if (Date.now() - lastRefresh > CACHE_REFRESH_MS) {
        void refreshSupabaseMonthCache(targetMonth).catch((err) => {
          console.warn('[Finance] background cache refresh error:', (err as any)?.message ?? err);
        });
      }

      if (!useSheets || !spreadsheetId) {
        return buildDashboardFromRows(rows, targetMonth);
      }
    }
  }

  if (rows.length === 0 && USE_SUPABASE) {
    try {
      const mappedRows = await refreshSupabaseMonthCache(targetMonth);
      rows = mappedRows;
      rows = dedupeLocalRowsWhenSupabaseExists(rows);
    } catch (err) {
      console.warn('[Finance] Supabase read error, falling back to SQLite:', (err as any)?.message ?? err);
    }
  }

  if (rows.length === 0) {
    rows = db.prepare(`
      SELECT id, remoteId, source, date, type, category, description, amount, tags, isEffective, effectiveAmount
      FROM finance_transactions
      WHERE date LIKE ?
      ORDER BY date DESC, id DESC
    `).all(`${targetMonth}%`) as Array<any>;
    rows = dedupeLocalRowsWhenSupabaseExists(rows);
  }

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
