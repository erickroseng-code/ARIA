import { SheetsService } from '@aria/integrations';
import { getSpreadsheetId } from '../finance.service';
import { SHEET_NAMES } from '../sheets-schema';
import { db } from '../../../config/db';
import { getSupabase } from '../../../config/supabase';
const USE_SUPABASE = process.env.FINANCE_USE_SUPABASE === 'true';
const USE_LOCAL_CACHE = process.env.FINANCE_LOCAL_READ_CACHE !== 'false';

export interface TransactionInput {
  type: 'receita' | 'despesa';
  category: string;
  description: string;
  amount: number;
  isEffective?: boolean;
  effectiveAmount?: number | null;
  date?: string; // YYYY-MM-DD
  paymentMethod?: string; // pix | credito | debito | outros
  creditCardId?: number | null;
}
export type TransactionSource = 'local' | 'sheets' | 'supabase';

export interface DebtInput {
  creditor: string;
  totalAmount: number;
  interestRate?: number;
  remainingInstallments?: number;
  dueDay?: number;
  dueDate?: string; // YYYY-MM-DD
  monthlyInstallment?: number;
}

export interface OverdueInput {
  account: string;
  overdueAmount: number;
  daysOverdue?: number;
  dueDate?: string; // YYYY-MM-DD
}

export interface DebtRecord {
  index: number | string;
  source: TransactionSource;
  creditor: string;
  totalAmount: number;
  interestRate: number;
  remainingInstallments: number;
  dueDay: number;
  dueDate: string;
  daysOverdue: number;
  monthlyInstallment: number;
}

export interface OverdueRecord {
  index: number | string;
  source: TransactionSource;
  account: string;
  overdueAmount: number;
  daysOverdue: number;
  dueDate: string;
  registeredAt: string;
  status: string;
  paidAmount: number | null;
  paidAt: string | null;
  paidTransactionId: number | null;
}

export interface RecurringExpenseInput {
  description: string;
  category: string;
  amount: number;
  dayOfMonth: number; // 1-31
  startMonth?: string; // YYYY-MM
}

export interface RecurringExpenseRecord {
  id: number;
  description: string;
  category: string;
  amount: number;
  dayOfMonth: number;
  startMonth: string;
  active: boolean;
  lastAppliedMonth: string | null;
}

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

  CREATE TABLE IF NOT EXISTS finance_debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    creditor TEXT NOT NULL,
    totalAmount REAL NOT NULL,
    interestRate REAL DEFAULT 0,
    remainingInstallments INTEGER DEFAULT 0,
    dueDay INTEGER DEFAULT 0,
    dueDate TEXT DEFAULT '',
    monthlyInstallment REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS finance_overdue_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account TEXT NOT NULL,
    overdueAmount REAL NOT NULL,
    daysOverdue INTEGER DEFAULT 0,
    dueDate TEXT DEFAULT '',
    registeredAt TEXT NOT NULL,
    status TEXT DEFAULT 'Pendente'
  );

  CREATE TABLE IF NOT EXISTS finance_recurring_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    dayOfMonth INTEGER NOT NULL,
    startMonth TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    lastAppliedMonth TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS finance_credit_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    bank TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT 'Visa',
    closingDay INTEGER NOT NULL DEFAULT 1,
    dueDay INTEGER NOT NULL DEFAULT 10,
    cardLimit REAL DEFAULT 0,
    createdAt TEXT NOT NULL
  );
`);

function hasColumn(tableName: string, columnName: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some(c => c.name === columnName);
}

if (!hasColumn('finance_debts', 'dueDate')) {
  db.exec(`ALTER TABLE finance_debts ADD COLUMN dueDate TEXT DEFAULT ''`);
}
if (!hasColumn('finance_overdue_accounts', 'dueDate')) {
  db.exec(`ALTER TABLE finance_overdue_accounts ADD COLUMN dueDate TEXT DEFAULT ''`);
}
if (!hasColumn('finance_overdue_accounts', 'paidAmount')) {
  db.exec(`ALTER TABLE finance_overdue_accounts ADD COLUMN paidAmount REAL DEFAULT NULL`);
}
if (!hasColumn('finance_overdue_accounts', 'paidAt')) {
  db.exec(`ALTER TABLE finance_overdue_accounts ADD COLUMN paidAt TEXT DEFAULT NULL`);
}
if (!hasColumn('finance_overdue_accounts', 'paidTransactionId')) {
  db.exec(`ALTER TABLE finance_overdue_accounts ADD COLUMN paidTransactionId INTEGER DEFAULT NULL`);
}
if (!hasColumn('finance_transactions', 'paymentMethod')) {
  db.exec(`ALTER TABLE finance_transactions ADD COLUMN paymentMethod TEXT DEFAULT 'outros'`);
}
if (!hasColumn('finance_transactions', 'remoteId')) {
  db.exec(`ALTER TABLE finance_transactions ADD COLUMN remoteId TEXT DEFAULT NULL`);
}
if (!hasColumn('finance_transactions', 'source')) {
  db.exec(`ALTER TABLE finance_transactions ADD COLUMN source TEXT DEFAULT 'local'`);
}
if (!hasColumn('finance_transactions', 'creditCardId')) {
  db.exec(`ALTER TABLE finance_transactions ADD COLUMN creditCardId INTEGER DEFAULT NULL`);
}
if (!hasColumn('finance_transactions', 'isEffective')) {
  db.exec(`ALTER TABLE finance_transactions ADD COLUMN isEffective INTEGER DEFAULT 1`);
}
if (!hasColumn('finance_transactions', 'effectiveAmount')) {
  db.exec(`ALTER TABLE finance_transactions ADD COLUMN effectiveAmount REAL DEFAULT NULL`);
}
db.exec(`UPDATE finance_transactions SET isEffective = 1 WHERE isEffective IS NULL`);
db.exec(`UPDATE finance_transactions SET source = 'local' WHERE source IS NULL OR source = ''`);

function normalizeMonth(month?: string): string {
  return (month && /^\d{4}-\d{2}$/.test(month))
    ? month
    : new Date().toISOString().slice(0, 7);
}

function getMonthDate(month: string, dayOfMonth: number): string {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const day = Math.max(1, Math.min(dayOfMonth, lastDay));
  return `${month}-${String(day).padStart(2, '0')}`;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function normalizeDate(date?: string): string {
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function getDueDayFromDate(dueDate?: string): number {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return 0;
  const day = parseInt(dueDate.split('-')[2], 10);
  return Number.isNaN(day) ? 0 : day;
}

function calculateDaysOverdue(dueDate?: string): number {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return 0;
  const due = new Date(`${dueDate}T00:00:00`);
  const now = new Date(`${todayISO()}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 0;
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 0);
}

function addLocalExpenseTransaction(description: string, amount: number, category = 'Outros'): number {
  const result = db.prepare(`
    INSERT INTO finance_transactions (date, type, category, description, amount, tags, isEffective)
    VALUES (?, 'despesa', ?, ?, ?, ?, 1)
  `).run(todayISO(), category, description, amount, 'pagamento');
  return Number(result.lastInsertRowid);
}

async function addSupabaseExpenseTransaction(
  description: string,
  amount: number,
  tags: string[] = ['efetivado'],
): Promise<void> {
  if (!USE_SUPABASE) return;
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('transactions')
      .insert({
        date: todayISO(),
        type: 'expense',
        category: 'Outros',
        description,
        amount,
        tags,
      });
    if (error) {
      throw new Error(error.message);
    }
  } catch (err: any) {
    console.warn('[Finance] Failed to mirror expense to Supabase:', err?.message ?? err);
  }
}

export async function addTransactionDirect(input: TransactionInput): Promise<void> {
  const useSheets = process.env.FINANCE_USE_SHEETS === 'true';
  const spreadsheetId = useSheets ? await getSpreadsheetId() : null;
  const date = input.date ?? new Date().toISOString().split('T')[0];
  const isEffective = Boolean(input.isEffective ?? (input.type === 'despesa'));
  const statusTag = isEffective ? 'efetivado' : 'previsto';

  if (useSheets && spreadsheetId) {
    try {
      const service = new SheetsService();
      await service.appendRows(spreadsheetId, `${SHEET_NAMES.TRANSACTIONS}!A1`, [
        [date, input.type, input.category, input.description, String(input.amount), statusTag],
      ]);
    } catch (err) {
      console.warn('[Finance] addTransactionDirect sheets error -> sqlite:', (err as any)?.message ?? err);
    }
  }

  if (USE_SUPABASE) {
    const supabase = getSupabase();
    const tags = statusTag.split(',').map((x: string) => x.trim()).filter(Boolean);
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        date,
        type: input.type === 'receita' ? 'income' : 'expense',
        category: input.category,
        description: input.description,
        amount: input.amount,
        tags,
      })
      .select('id')
      .single();
    if (error) {
      throw new Error(`Falha ao inserir transação no Supabase: ${error.message}`);
    }

    if (USE_LOCAL_CACHE) {
      db.prepare(`
        INSERT INTO finance_transactions (remoteId, source, date, type, category, description, amount, tags, paymentMethod, creditCardId, isEffective, effectiveAmount)
        VALUES (?, 'supabase', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        String(data?.id ?? ''),
        date,
        input.type,
        input.category,
        input.description,
        input.amount,
        statusTag,
        input.paymentMethod ?? 'outros',
        input.creditCardId ?? null,
        isEffective ? 1 : 0,
        null,
      );
    }
    return;
  }

  db.prepare(`
    INSERT INTO finance_transactions (source, date, type, category, description, amount, tags, paymentMethod, creditCardId, isEffective, effectiveAmount)
    VALUES ('local', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    date,
    input.type,
    input.category,
    input.description,
    input.amount,
    statusTag,
    input.paymentMethod ?? 'outros',
    input.creditCardId ?? null,
    isEffective ? 1 : 0,
    null,
  );
}

export async function updateTransactionDirect(
  index: number | string,
  input: TransactionInput,
  source: TransactionSource = 'local',
): Promise<void> {
  const date = input.date ?? new Date().toISOString().split('T')[0];
  const spreadsheetId = await getSpreadsheetId();

  if (source === 'sheets' && spreadsheetId) {
    try {
      const service = new SheetsService();
      const rowNum = Number(index) + 2; // A2 is index 0
      await service.writeRange(spreadsheetId, `${SHEET_NAMES.TRANSACTIONS}!A${rowNum}:F${rowNum}`, [[
        date,
        input.type,
        input.category,
        input.description,
        String(input.amount),
        (input.isEffective ?? (input.type === 'despesa')) ? 'efetivado' : 'previsto',
      ]]);
      return;
    } catch (err) {
      console.warn('[Finance] updateTransactionDirect sheets fallback -> sqlite:', (err as any)?.message ?? err);
    }
  }

  if (USE_SUPABASE && (source === 'supabase' || (typeof index === 'string' && index.includes('-')))) {
    const supabase = getSupabase();
    const isEffective = Boolean(input.isEffective ?? (input.type === 'despesa'));
    const tags = [isEffective ? 'efetivado' : 'previsto'];
    const { error } = await supabase
      .from('transactions')
      .update({
        date,
        type: input.type === 'receita' ? 'income' : 'expense',
        category: input.category,
        description: input.description,
        amount: input.amount,
        tags,
      })
      .eq('id', String(index));
    if (error) {
      throw new Error(`Falha ao atualizar transação no Supabase: ${error.message}`);
    }
    if (USE_LOCAL_CACHE) {
      db.prepare(`
        UPDATE finance_transactions
        SET date = ?, type = ?, category = ?, description = ?, amount = ?, tags = ?, isEffective = COALESCE(?, isEffective)
        WHERE remoteId = ?
      `).run(
        date,
        input.type,
        input.category,
        input.description,
        input.amount,
        tags.join(','),
        typeof input.isEffective === 'boolean' ? (input.isEffective ? 1 : 0) : null,
        String(index),
      );
    }
    return;
  }

  db.prepare(`
    UPDATE finance_transactions
    SET date = ?, type = ?, category = ?, description = ?, amount = ?, isEffective = COALESCE(?, isEffective), tags = COALESCE(?, tags)
    WHERE id = ?
  `).run(
    date,
    input.type,
    input.category,
    input.description,
    input.amount,
    typeof input.isEffective === 'boolean' ? (input.isEffective ? 1 : 0) : null,
    input.type === 'receita' && typeof input.isEffective === 'boolean'
      ? (input.isEffective ? 'efetivado' : 'previsto')
      : null,
    index,
  );
}

export async function updateTransactionEffectiveDirect(
  index: number | string,
  isEffective: boolean,
  actualAmount?: number,
  source: TransactionSource = 'local',
): Promise<void> {
  const hasCustomAmount = Number.isFinite(actualAmount) && Number(actualAmount) > 0;
  const statusTag = !isEffective
    ? 'previsto'
    : (hasCustomAmount ? `efetivado:${Number(actualAmount).toFixed(2)}` : 'efetivado');

  if (source === 'sheets') {
    const spreadsheetId = await getSpreadsheetId();
    if (!spreadsheetId) {
      throw new Error('Planilha não configurada para source=sheets');
    }
    try {
      const service = new SheetsService();
      const rowNum = Number(index) + 2; // A2 is index 0
      await service.writeRange(
        spreadsheetId,
        `${SHEET_NAMES.TRANSACTIONS}!F${rowNum}:F${rowNum}`,
        [[statusTag]],
      );
      return;
    } catch (err) {
      throw new Error(`Falha ao atualizar efetivação na planilha: ${(err as any)?.message ?? err}`);
    }
  }

  // Se for UUID (string com hífen), é do Supabase
  if (USE_SUPABASE && (source === 'supabase' || (typeof index === 'string' && index.includes('-')))) {
    try {
      const supabase = getSupabase();
      const tags = statusTag.split(',').map((x: string) => x.trim()).filter(Boolean);
      const { error } = await supabase
        .from('transactions')
        .update({ tags })
        .eq('id', String(index));

      if (error) throw error;

      console.log('[Finance] Updated Supabase transaction:', index);
      if (USE_LOCAL_CACHE) {
        db.prepare(`
          UPDATE finance_transactions
          SET isEffective = ?, tags = ?, effectiveAmount = ?
          WHERE remoteId = ?
        `).run(
          isEffective ? 1 : 0,
          statusTag,
          isEffective
            ? (hasCustomAmount ? Number(actualAmount) : null)
            : null,
          String(index),
        );
      }
      return;
    } catch (err: any) {
      console.warn('[Finance] Failed to update Supabase:', err.message);
      // Continua pra tentar SQLite como fallback
    }
  }

  // Fallback pra SQLite
  const numIndex = Number(index);
  const current = db.prepare(`
    SELECT type, tags, date
    FROM finance_transactions
    WHERE id = ?
    LIMIT 1
  `).get(numIndex) as { type?: string; tags?: string; date?: string } | undefined;

  const currentType = String(current?.type ?? '');
  const currentTags = String(current?.tags ?? '');
  const keepRecurringTag = currentType === 'despesa' && currentTags.startsWith('recorrente:');
  const nextTags = keepRecurringTag ? currentTags : statusTag;

  db.prepare(`
    UPDATE finance_transactions
    SET isEffective = ?, tags = ?, effectiveAmount = ?
    WHERE id = ?
  `).run(
    isEffective ? 1 : 0,
    nextTags,
    isEffective
      ? (hasCustomAmount ? Number(actualAmount) : null)
      : null,
    numIndex,
  );
}

export async function deleteTransactionDirect(
  index: number | string,
  source: TransactionSource = 'local',
): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();

  if (source === 'sheets' && spreadsheetId) {
    try {
      const service = new SheetsService();
      const rowNum = Number(index) + 2; // A2 is index 0
      await service.clearRange(spreadsheetId, `${SHEET_NAMES.TRANSACTIONS}!A${rowNum}:F${rowNum}`);
      return;
    } catch (err) {
      console.warn('[Finance] deleteTransactionDirect sheets fallback -> sqlite:', (err as any)?.message ?? err);
    }
  }

  if (USE_SUPABASE && (source === 'supabase' || (typeof index === 'string' && index.includes('-')))) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', String(index));
    if (error) {
      throw new Error(`Falha ao remover transação do Supabase: ${error.message}`);
    }
    if (USE_LOCAL_CACHE) {
      db.prepare('DELETE FROM finance_transactions WHERE remoteId = ?').run(String(index));
    }
    return;
  }

  db.prepare('DELETE FROM finance_transactions WHERE id = ?').run(index);
}

export async function getDebts(): Promise<DebtRecord[]> {
  const spreadsheetId = await getSpreadsheetId();
  if (spreadsheetId) {
    try {
      const service = new SheetsService();
      const data = await service.readRange(spreadsheetId, `${SHEET_NAMES.DEBTS}!A2:G200`);
      const fromSheets = data.values
        .map((row, i) => ({
          index: i,
          source: 'sheets' as const,
          creditor: row[0] ?? '',
          totalAmount: parseFloat(row[1] ?? '0') || 0,
          interestRate: parseFloat(row[2] ?? '0') || 0,
          remainingInstallments: parseInt(row[3] ?? '0') || 0,
          dueDay: parseInt(row[4] ?? '0') || 0,
          dueDate: normalizeDate(row[6] ?? ''),
          daysOverdue: calculateDaysOverdue(row[6] ?? ''),
          monthlyInstallment: parseFloat(row[5] ?? '0') || 0,
        }))
        .filter(d => d.creditor.trim() !== '');
      if (fromSheets.length > 0) return fromSheets;
    } catch (err) {
      console.warn('[Finance] getDebts fallback -> sqlite:', (err as any)?.message ?? err);
    }
  }

  const rows = db.prepare(`
    SELECT id, creditor, totalAmount, interestRate, remainingInstallments, dueDay, dueDate, monthlyInstallment
    FROM finance_debts
    ORDER BY id DESC
  `).all() as Array<any>;

  return rows.map(r => ({
    index: Number(r.id),
    source: 'local' as const,
    creditor: String(r.creditor ?? ''),
    totalAmount: Number(r.totalAmount ?? 0),
    interestRate: Number(r.interestRate ?? 0),
    remainingInstallments: Number(r.remainingInstallments ?? 0),
    dueDay: Number(r.dueDay ?? 0),
    dueDate: normalizeDate(String(r.dueDate ?? '')),
    daysOverdue: calculateDaysOverdue(String(r.dueDate ?? '')),
    monthlyInstallment: Number(r.monthlyInstallment ?? 0),
  }));
}

export async function addDebt(input: DebtInput): Promise<void> {
  const dueDate = normalizeDate(input.dueDate);
  const dueDay = input.dueDay ?? getDueDayFromDate(dueDate);
  const spreadsheetId = await getSpreadsheetId();
  if (spreadsheetId) {
    try {
      const service = new SheetsService();
      await service.appendRows(spreadsheetId, `${SHEET_NAMES.DEBTS}!A1`, [[
        input.creditor,
        String(input.totalAmount),
        String(input.interestRate ?? 0),
        String(input.remainingInstallments ?? 0),
        String(dueDay),
        String(input.monthlyInstallment ?? 0),
        dueDate,
      ]]);
      return;
    } catch (err) {
      console.warn('[Finance] addDebt fallback -> sqlite:', (err as any)?.message ?? err);
    }
  }

  db.prepare(`
    INSERT INTO finance_debts (creditor, totalAmount, interestRate, remainingInstallments, dueDay, dueDate, monthlyInstallment)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.creditor,
    input.totalAmount,
    input.interestRate ?? 0,
    input.remainingInstallments ?? 0,
    dueDay,
    dueDate,
    input.monthlyInstallment ?? 0,
  );
}

export async function deleteDebt(
  rowIndex: number,
  source: TransactionSource = 'local',
): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  if (source === 'sheets' && spreadsheetId) {
    try {
      const service = new SheetsService();
      const sheetRow = Number(rowIndex) + 2;
      await service.clearRange(spreadsheetId, `${SHEET_NAMES.DEBTS}!A${sheetRow}:G${sheetRow}`);
      return;
    } catch (err) {
      console.warn('[Finance] deleteDebt fallback -> sqlite:', (err as any)?.message ?? err);
    }
  }

  db.prepare('DELETE FROM finance_debts WHERE id = ?').run(rowIndex);
}

export async function getOverdueAccounts(): Promise<OverdueRecord[]> {
  const supabaseRecords: OverdueRecord[] = [];
  // Tentar Supabase primeiro
  try {
    if (!USE_SUPABASE) throw new Error('Supabase disabled for local-first mode');
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('overdue_accounts')
      .select('*')
      .order('status', { ascending: true })
      .order('id', { ascending: false });

    if (!error && data && data.length > 0) {
      console.log('[Finance] Loaded', data.length, 'overdue accounts from Supabase');
      const deriveDueDate = (r: any): string => {
        const explicitDue = normalizeDate(String(r.due_date ?? ''));
        if (explicitDue) return explicitDue;
        const registrationDate = normalizeDate(String(r.registration_date ?? ''));
        const daysOverdue = Number(r.days_overdue ?? 0);
        if (!registrationDate || !Number.isFinite(daysOverdue) || daysOverdue <= 0) return '';
        const reg = new Date(`${registrationDate}T00:00:00`);
        if (Number.isNaN(reg.getTime())) return '';
        reg.setDate(reg.getDate() - daysOverdue);
        return reg.toISOString().slice(0, 10);
      };

      const normalizeStatus = (status: string): string => {
        const s = String(status ?? '').toLowerCase().trim();
        if (s === 'pago' || s === 'resolved') return 'Pago';
        return 'Pendente';
      };

      supabaseRecords.push(...data.map((r: any) => {
        const dueDate = deriveDueDate(r);
        return {
          index: String(r.id ?? ''),
          source: 'supabase' as const,
          account: String(r.account_name ?? ''),
          overdueAmount: Number(r.overdue_amount ?? 0),
          daysOverdue: calculateDaysOverdue(dueDate) || Number(r.days_overdue ?? 0),
          dueDate,
          registeredAt: String(r.registration_date ?? ''),
          status: normalizeStatus(String(r.status ?? 'pendente')),
          paidAmount: r.paid_amount ? Number(r.paid_amount) : null,
          paidAt: r.paid_at ?? null,
          paidTransactionId: r.paid_transaction_id ?? null,
        };
      }));
    }
  } catch (err: any) {
    console.warn('[Finance] Supabase overdue read error:', err.message);
  }

  // Fallback para Sheets
  const useSheets = process.env.FINANCE_USE_SHEETS === 'true';
  if (useSheets) {
    const spreadsheetId = await getSpreadsheetId();
    if (spreadsheetId) {
    try {
      const service = new SheetsService();
      const data = await service.readRange(spreadsheetId, `${SHEET_NAMES.OVERDUE_ACCOUNTS}!A2:F200`);
      const fromSheets = data.values
        .map((row, i) => ({
          index: i,
          source: 'sheets' as const,
          account: row[0] ?? '',
          overdueAmount: parseFloat(row[1] ?? '0') || 0,
          daysOverdue: calculateDaysOverdue(row[5] ?? '') || (parseInt(row[2] ?? '0') || 0),
          dueDate: normalizeDate(row[5] ?? ''),
          registeredAt: row[3] ?? '',
          status: row[4] ?? 'Pendente',
          paidAmount: null,
          paidAt: null,
          paidTransactionId: null,
        }))
        .filter(d => d.account.trim() !== '');
      if (fromSheets.length > 0 && supabaseRecords.length === 0) return fromSheets;
    } catch (err) {
      console.warn('[Finance] getOverdueAccounts fallback -> sqlite:', (err as any)?.message ?? err);
    }
    }
  }

  const rows = db.prepare(`
    SELECT id, account, overdueAmount, daysOverdue, dueDate, registeredAt, status, paidAmount, paidAt, paidTransactionId
    FROM finance_overdue_accounts
    ORDER BY status ASC, id DESC
  `).all() as Array<any>;

  const sqliteRecords = rows.map(r => ({
    index: Number(r.id),
    source: 'local' as const,
    account: String(r.account ?? ''),
    overdueAmount: Number(r.overdueAmount ?? 0),
    daysOverdue: calculateDaysOverdue(String(r.dueDate ?? '')) || Number(r.daysOverdue ?? 0),
    dueDate: normalizeDate(String(r.dueDate ?? '')),
    registeredAt: String(r.registeredAt ?? ''),
    status: String(r.status ?? 'Pendente'),
    paidAmount: r.paidAmount != null ? Number(r.paidAmount) : null,
    paidAt: r.paidAt ? String(r.paidAt) : null,
    paidTransactionId: r.paidTransactionId != null ? Number(r.paidTransactionId) : null,
  }));

  if (supabaseRecords.length === 0) return sqliteRecords;

  const dedupe = new Set<string>();
  const combined = [...supabaseRecords, ...sqliteRecords].filter((r) => {
    const key = `${String(r.account).toLowerCase()}|${Number(r.overdueAmount).toFixed(2)}|${r.dueDate}|${r.status}`;
    if (dedupe.has(key)) return false;
    dedupe.add(key);
    return true;
  });

  return combined;
}

export async function addOverdueAccount(input: OverdueInput): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  const today = new Date().toISOString().split('T')[0];
  const dueDate = normalizeDate(input.dueDate);
  const daysOverdue = calculateDaysOverdue(dueDate) || (input.daysOverdue ?? 0);
  if (spreadsheetId) {
    try {
      const service = new SheetsService();
      await service.appendRows(spreadsheetId, `${SHEET_NAMES.OVERDUE_ACCOUNTS}!A1`, [[
        input.account,
        String(input.overdueAmount),
        String(daysOverdue),
        today,
        'Pendente',
        dueDate,
      ]]);
      return;
    } catch (err) {
      console.warn('[Finance] addOverdueAccount fallback -> sqlite:', (err as any)?.message ?? err);
    }
  }

  db.prepare(`
    INSERT INTO finance_overdue_accounts (account, overdueAmount, daysOverdue, dueDate, registeredAt, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(input.account, input.overdueAmount, daysOverdue, dueDate, today, 'Pendente');
}

export async function deleteOverdueAccount(
  rowIndex: number | string,
  source: TransactionSource = 'local',
): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();
  if (source === 'sheets' && spreadsheetId) {
    try {
      const service = new SheetsService();
      const sheetRow = Number(rowIndex) + 2;
      await service.clearRange(spreadsheetId, `${SHEET_NAMES.OVERDUE_ACCOUNTS}!A${sheetRow}:F${sheetRow}`);
      return;
    } catch (err) {
      console.warn('[Finance] deleteOverdueAccount fallback -> sqlite:', (err as any)?.message ?? err);
    }
  }

  if (USE_SUPABASE && (source === 'supabase' || (typeof rowIndex === 'string' && rowIndex.includes('-')))) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('overdue_accounts')
      .delete()
      .eq('id', String(rowIndex));
    if (error) {
      throw new Error(`Falha ao remover conta atrasada no Supabase: ${error.message}`);
    }
    return;
  }

  db.prepare('DELETE FROM finance_overdue_accounts WHERE id = ?').run(rowIndex);
}

export async function payDebt(
  index: number,
  source: TransactionSource = 'local',
  mode: 'installment' | 'full' = 'installment',
  amount?: number,
): Promise<void> {
  const spreadsheetId = await getSpreadsheetId();

  if (source === 'sheets' && spreadsheetId) {
    try {
      const service = new SheetsService();
      const rowNum = index + 2;
      const data = await service.readRange(spreadsheetId, `${SHEET_NAMES.DEBTS}!A${rowNum}:G${rowNum}`);
      const row = data.values[0] ?? [];
      if (!row[0]) throw new Error('Dívida não encontrada');

      const creditor = String(row[0] ?? 'Dívida');
      const totalAmount = parseFloat(row[1] ?? '0') || 0;
      const remainingInstallments = parseInt(row[3] ?? '0') || 0;
      const monthlyInstallment = parseFloat(row[5] ?? '0') || 0;

      const paymentAmount = mode === 'full'
        ? totalAmount
        : (amount && amount > 0 ? amount : (monthlyInstallment > 0 ? monthlyInstallment : 0));

      if (paymentAmount <= 0) throw new Error('Valor de pagamento inválido');

      const newTotal = Math.max(totalAmount - paymentAmount, 0);
      const newInstallments = mode === 'full'
        ? 0
        : (remainingInstallments > 0 ? Math.max(remainingInstallments - 1, 0) : 0);

      if (newTotal <= 0 || newInstallments === 0) {
        await service.clearRange(spreadsheetId, `${SHEET_NAMES.DEBTS}!A${rowNum}:G${rowNum}`);
      } else {
        await service.writeRange(spreadsheetId, `${SHEET_NAMES.DEBTS}!A${rowNum}:G${rowNum}`, [[
          creditor,
          String(newTotal),
          row[2] ?? '0',
          String(newInstallments),
          row[4] ?? '0',
          row[5] ?? '0',
          row[6] ?? '',
        ]]);
      }
      addLocalExpenseTransaction(`Pagamento dívida - ${creditor}`, paymentAmount, 'Outros');
      return;
    } catch (err) {
      console.warn('[Finance] payDebt sheets fallback -> sqlite:', (err as any)?.message ?? err);
    }
  }

  const current = db.prepare(`
    SELECT id, creditor, totalAmount, remainingInstallments, monthlyInstallment
    FROM finance_debts
    WHERE id = ?
  `).get(index) as any;
  if (!current) throw new Error('Dívida não encontrada');

  const totalAmount = Number(current.totalAmount ?? 0);
  const remainingInstallments = Number(current.remainingInstallments ?? 0);
  const monthlyInstallment = Number(current.monthlyInstallment ?? 0);
  const paymentAmount = mode === 'full'
    ? totalAmount
    : (amount && amount > 0 ? amount : (monthlyInstallment > 0 ? monthlyInstallment : 0));
  if (paymentAmount <= 0) throw new Error('Valor de pagamento inválido');

  const newTotal = Math.max(totalAmount - paymentAmount, 0);
  const newInstallments = mode === 'full'
    ? 0
    : (remainingInstallments > 0 ? Math.max(remainingInstallments - 1, 0) : 0);

  if (newTotal <= 0 || newInstallments === 0) {
    db.prepare('DELETE FROM finance_debts WHERE id = ?').run(index);
  } else {
    db.prepare(`
      UPDATE finance_debts
      SET totalAmount = ?, remainingInstallments = ?
      WHERE id = ?
    `).run(newTotal, newInstallments, index);
  }
  addLocalExpenseTransaction(`Pagamento dívida - ${String(current.creditor ?? 'Dívida')}`, paymentAmount, 'Outros');
}

export async function payOverdue(
  index: number | string,
  source: TransactionSource = 'local',
  _mode: 'partial' | 'full' = 'partial',
  amount?: number,
): Promise<void> {
  if (USE_SUPABASE && (source === 'supabase' || (typeof index === 'string' && index.includes('-')))) {
    const supabase = getSupabase();
    const { data: current, error: currentError } = await supabase
      .from('overdue_accounts')
      .select('*')
      .eq('id', String(index))
      .single();

    if (currentError || !current) throw new Error('Conta atrasada não encontrada');

    const currentStatus = String(current.status ?? '').toLowerCase();
    if (currentStatus === 'pago' || currentStatus === 'resolved') {
      throw new Error('Conta já está paga. Use desfazer para revertê-la.');
    }

    const overdueAmount = Number(current.overdue_amount ?? 0);
    const paymentAmount = amount && amount > 0 ? amount : overdueAmount;
    if (paymentAmount <= 0) throw new Error('Valor de pagamento inválido');

    const today = todayISO();
    const accountName = String(current.account_name ?? 'Conta atrasada');

    const { data: txRow, error: txError } = await supabase
      .from('transactions')
      .insert({
        date: today,
        type: 'expense',
        category: 'Outros',
        description: `Pagamento conta atrasada - ${accountName}`,
        amount: paymentAmount,
        tags: ['efetivado', 'pagamento-atrasada'],
      })
      .select('id')
      .single();

    if (txError) {
      throw new Error(`Falha ao registrar pagamento no Supabase: ${txError.message}`);
    }

    const txId = txRow?.id ?? null;
    const payloadWithPaidFields = {
      status: 'Pago',
      paid_amount: paymentAmount,
      paid_at: today,
      paid_transaction_id: txId,
    };

    let updateError: any = null;
    const updateWithPaid = await supabase
      .from('overdue_accounts')
      .update(payloadWithPaidFields)
      .eq('id', String(index));
    updateError = updateWithPaid.error;

    if (updateError) {
      const updateStatusOnly = await supabase
        .from('overdue_accounts')
        .update({ status: 'Pago' })
        .eq('id', String(index));
      if (updateStatusOnly.error) {
        throw new Error(`Falha ao atualizar conta atrasada no Supabase: ${updateStatusOnly.error.message}`);
      }
    }
    return;
  }

  const current = db.prepare(`
    SELECT id, account, overdueAmount, status
    FROM finance_overdue_accounts
    WHERE id = ?
  `).get(index) as any;
  if (!current) throw new Error('Conta atrasada não encontrada');
  if (String(current.status ?? '') === 'Pago') throw new Error('Conta já está paga. Use desfazer para revertê-la.');

  const overdueAmount = Number(current.overdueAmount ?? 0);
  const paymentAmount = amount && amount > 0 ? amount : overdueAmount;
  if (paymentAmount <= 0) throw new Error('Valor de pagamento inválido');

  const txId = addLocalExpenseTransaction(
    `Pagamento conta atrasada - ${String(current.account ?? 'Conta atrasada')}`,
    paymentAmount,
    'Outros',
  );
  await addSupabaseExpenseTransaction(
    `Pagamento conta atrasada - ${String(current.account ?? 'Conta atrasada')}`,
    paymentAmount,
    ['efetivado', 'pagamento-atrasada'],
  );

  db.prepare(`
    UPDATE finance_overdue_accounts
    SET status = 'Pago', paidAmount = ?, paidAt = ?, paidTransactionId = ?
    WHERE id = ?
  `).run(paymentAmount, todayISO(), txId, index);
}

export async function undoPayOverdue(
  index: number | string,
  source: TransactionSource = 'local',
): Promise<void> {
  if (USE_SUPABASE && (source === 'supabase' || (typeof index === 'string' && index.includes('-')))) {
    const supabase = getSupabase();
    const { data: current, error: currentError } = await supabase
      .from('overdue_accounts')
      .select('*')
      .eq('id', String(index))
      .single();

    if (currentError || !current) throw new Error('Conta atrasada não encontrada');

    const currentStatus = String(current.status ?? '').toLowerCase();
    if (currentStatus !== 'pago' && currentStatus !== 'resolved') {
      throw new Error('Conta não está marcada como paga.');
    }

    if (current.paid_transaction_id) {
      await supabase
        .from('transactions')
        .delete()
        .eq('id', String(current.paid_transaction_id));
    }

    const resetPayload = {
      status: 'Pendente',
      paid_amount: null,
      paid_at: null,
      paid_transaction_id: null,
    };

    const resetWithPaidFields = await supabase
      .from('overdue_accounts')
      .update(resetPayload)
      .eq('id', String(index));

    if (resetWithPaidFields.error) {
      const resetStatusOnly = await supabase
        .from('overdue_accounts')
        .update({ status: 'Pendente' })
        .eq('id', String(index));
      if (resetStatusOnly.error) {
        throw new Error(`Falha ao desfazer pagamento no Supabase: ${resetStatusOnly.error.message}`);
      }
    }
    return;
  }

  const current = db.prepare(`
    SELECT id, account, status, paidTransactionId
    FROM finance_overdue_accounts
    WHERE id = ?
  `).get(index) as any;
  if (!current) throw new Error('Conta atrasada não encontrada');
  if (String(current.status ?? '') !== 'Pago') throw new Error('Conta não está marcada como paga.');

  if (current.paidTransactionId) {
    db.prepare('DELETE FROM finance_transactions WHERE id = ?').run(Number(current.paidTransactionId));
  }

  db.prepare(`
    UPDATE finance_overdue_accounts
    SET status = 'Pendente', paidAmount = NULL, paidAt = NULL, paidTransactionId = NULL
    WHERE id = ?
  `).run(index);
}

export async function getRecurringExpenses(): Promise<RecurringExpenseRecord[]> {
  // Tentar Supabase primeiro
  try {
    if (!USE_SUPABASE) throw new Error('Supabase disabled for local-first mode');
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('recurring_expenses')
      .select('*')
      .order('active', { ascending: false })
      .order('day_of_month', { ascending: true })
      .order('id', { ascending: false });

    if (!error && data && data.length > 0) {
      console.log('[Finance] Loaded', data.length, 'recurring expenses from Supabase');
      return data.map((r: any, idx: number) => ({
        id: idx + 1,
        description: String(r.description ?? ''),
        category: String(r.category ?? ''),
        amount: Number(r.amount ?? 0),
        dayOfMonth: Number(r.day_of_month ?? 0),
        startMonth: String(r.start_month ?? ''),
        active: Boolean(r.active ?? true),
        lastAppliedMonth: String(r.last_applied_month ?? ''),
      }));
    }
  } catch (err: any) {
    console.warn('[Finance] Supabase recurring read error:', err.message);
  }

  // Fallback para SQLite
  const rows = db.prepare(`
    SELECT id, description, category, amount, dayOfMonth, startMonth, active, lastAppliedMonth
    FROM finance_recurring_expenses
    ORDER BY active DESC, dayOfMonth ASC, id DESC
  `).all() as Array<any>;

  return rows.map(r => ({
    id: Number(r.id),
    description: String(r.description ?? ''),
    category: String(r.category ?? 'Outros'),
    amount: Number(r.amount ?? 0),
    dayOfMonth: Number(r.dayOfMonth ?? 1),
    startMonth: String(r.startMonth ?? normalizeMonth()),
    active: Number(r.active ?? 1) === 1,
    lastAppliedMonth: r.lastAppliedMonth ? String(r.lastAppliedMonth) : null,
  }));
}

export async function addRecurringExpense(input: RecurringExpenseInput): Promise<void> {
  const startMonth = normalizeMonth(input.startMonth);
  const today = new Date().toISOString().split('T')[0];
  db.prepare(`
    INSERT INTO finance_recurring_expenses (description, category, amount, dayOfMonth, startMonth, active, lastAppliedMonth, createdAt)
    VALUES (?, ?, ?, ?, ?, 1, NULL, ?)
  `).run(
    input.description,
    input.category,
    input.amount,
    Math.max(1, Math.min(input.dayOfMonth, 31)),
    startMonth,
    today,
  );
}

export async function updateRecurringExpense(
  id: number,
  input: Partial<RecurringExpenseInput & { active: boolean }>,
): Promise<void> {
  const current = db.prepare(`
    SELECT id, description, category, amount, dayOfMonth, startMonth, active
    FROM finance_recurring_expenses
    WHERE id = ?
  `).get(id) as any;
  if (!current) throw new Error('Recorrência não encontrada');

  db.prepare(`
    UPDATE finance_recurring_expenses
    SET description = ?, category = ?, amount = ?, dayOfMonth = ?, startMonth = ?, active = ?
    WHERE id = ?
  `).run(
    input.description ?? current.description,
    input.category ?? current.category,
    input.amount ?? current.amount,
    Math.max(1, Math.min(input.dayOfMonth ?? current.dayOfMonth, 31)),
    normalizeMonth(input.startMonth ?? current.startMonth),
    (input.active ?? (Number(current.active) === 1)) ? 1 : 0,
    id,
  );
}

export async function deleteRecurringExpense(id: number): Promise<void> {
  db.prepare('DELETE FROM finance_recurring_expenses WHERE id = ?').run(id);
}

export interface CreditCardInput {
  name: string;
  bank: string;
  brand?: string;
  closingDay: number;
  dueDay: number;
  cardLimit?: number;
}

export interface CreditCardRecord {
  id: number;
  name: string;
  bank: string;
  brand: string;
  closingDay: number;
  dueDay: number;
  cardLimit: number;
  createdAt: string;
}

export async function getCreditCards(): Promise<CreditCardRecord[]> {
  const rows = db.prepare(`
    SELECT id, name, bank, brand, closingDay, dueDay, cardLimit, createdAt
    FROM finance_credit_cards
    ORDER BY id ASC
  `).all() as Array<any>;

  return rows.map(r => ({
    id: Number(r.id),
    name: String(r.name ?? ''),
    bank: String(r.bank ?? ''),
    brand: String(r.brand ?? 'Visa'),
    closingDay: Number(r.closingDay ?? 1),
    dueDay: Number(r.dueDay ?? 10),
    cardLimit: Number(r.cardLimit ?? 0),
    createdAt: String(r.createdAt ?? ''),
  }));
}

export async function addCreditCard(input: CreditCardInput): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  db.prepare(`
    INSERT INTO finance_credit_cards (name, bank, brand, closingDay, dueDay, cardLimit, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.name,
    input.bank,
    input.brand ?? 'Visa',
    Math.max(1, Math.min(input.closingDay, 31)),
    Math.max(1, Math.min(input.dueDay, 31)),
    input.cardLimit ?? 0,
    today,
  );
}

export async function deleteCreditCard(id: number): Promise<void> {
  db.prepare('DELETE FROM finance_credit_cards WHERE id = ?').run(id);
}

/**
 * Materializa despesas fixas no mês (idempotente por recorrência/mês).
 */
export async function applyRecurringExpensesForMonth(month?: string): Promise<void> {
  const targetMonth = normalizeMonth(month);
  const rows = db.prepare(`
    SELECT id, description, category, amount, dayOfMonth, startMonth, active, lastAppliedMonth
    FROM finance_recurring_expenses
    WHERE active = 1
  `).all() as Array<any>;

  for (const row of rows) {
    const startMonth = String(row.startMonth ?? targetMonth);
    const lastApplied = row.lastAppliedMonth ? String(row.lastAppliedMonth) : null;
    const recurringId = Number(row.id ?? 0);
    const recurringTag = `recorrente:${recurringId}:${targetMonth}`;
    const txDate = getMonthDate(targetMonth, Number(row.dayOfMonth ?? 1));
    const txCategory = String(row.category ?? 'Outros');
    const txDescription = String(row.description ?? 'Despesa fixa');
    const txAmount = Number(row.amount ?? 0);
    if (startMonth > targetMonth) continue;

    // Reconcilia legado: se já existe lançamento recorrente equivalente (tag antiga ou nova),
    // mantém apenas 1 linha e normaliza para a tag única da recorrência+mês.
    const equivalentRows = db.prepare(`
      SELECT id, tags
      FROM finance_transactions
      WHERE date = ?
        AND type = 'despesa'
        AND category = ?
        AND description = ?
        AND ABS(amount - ?) < 0.000001
        AND (tags = 'recorrente' OR tags LIKE 'recorrente:%')
      ORDER BY id ASC
    `).all(txDate, txCategory, txDescription, txAmount) as Array<{ id: number; tags: string }>;

    if (equivalentRows.length > 0) {
      const keeper = equivalentRows[0];
      if (keeper.tags !== recurringTag) {
        db.prepare(`
          UPDATE finance_transactions
          SET tags = ?
          WHERE id = ?
        `).run(recurringTag, keeper.id);
      }
      if (equivalentRows.length > 1) {
        const duplicateIds = equivalentRows.slice(1).map(r => r.id);
        for (const dupId of duplicateIds) {
          db.prepare('DELETE FROM finance_transactions WHERE id = ?').run(dupId);
        }
      }
      if (lastApplied !== targetMonth) {
        db.prepare(`
          UPDATE finance_recurring_expenses
          SET lastAppliedMonth = ?
          WHERE id = ?
        `).run(targetMonth, recurringId);
      }
      continue;
    }

    // Idempotência real: evita duplicar ao navegar entre meses e ao reiniciar servidor.
    const alreadyMaterialized = db.prepare(`
      SELECT id
      FROM finance_transactions
      WHERE tags = ?
      LIMIT 1
    `).get(recurringTag) as { id: number } | undefined;
    if (alreadyMaterialized) {
      if (lastApplied !== targetMonth) {
        db.prepare(`
          UPDATE finance_recurring_expenses
          SET lastAppliedMonth = ?
          WHERE id = ?
        `).run(targetMonth, recurringId);
      }
      continue;
    }

    db.prepare(`
      INSERT INTO finance_transactions (date, type, category, description, amount, tags, isEffective)
      VALUES (?, 'despesa', ?, ?, ?, ?, 0)
    `).run(
      txDate,
      txCategory,
      txDescription,
      txAmount,
      recurringTag,
    );

    db.prepare(`
      UPDATE finance_recurring_expenses
      SET lastAppliedMonth = ?
      WHERE id = ?
    `).run(targetMonth, recurringId);
  }
}
