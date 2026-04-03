import { SheetsService } from '@aria/integrations';
import { getSpreadsheetId } from '../finance.service';
import { SHEET_NAMES } from '../sheets-schema';
import { db } from '../../../config/db';

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
export type TransactionSource = 'local' | 'sheets';

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
  index: number;
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
  index: number;
  source: TransactionSource;
  account: string;
  overdueAmount: number;
  daysOverdue: number;
  dueDate: string;
  registeredAt: string;
  status: string;
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
if (!hasColumn('finance_transactions', 'paymentMethod')) {
  db.exec(`ALTER TABLE finance_transactions ADD COLUMN paymentMethod TEXT DEFAULT 'outros'`);
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

function addLocalExpenseTransaction(description: string, amount: number, category = 'Outros'): void {
  db.prepare(`
    INSERT INTO finance_transactions (date, type, category, description, amount, tags, isEffective)
    VALUES (?, 'despesa', ?, ?, ?, ?, 1)
  `).run(todayISO(), category, description, amount, 'pagamento');
}

export async function addTransactionDirect(input: TransactionInput): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  const date = input.date ?? new Date().toISOString().split('T')[0];
  const isEffective = Boolean(input.isEffective ?? (input.type === 'despesa'));
  const statusTag = isEffective ? 'efetivado' : 'previsto';

  if (spreadsheetId) {
    try {
      const service = new SheetsService();
      await service.appendRows(spreadsheetId, `${SHEET_NAMES.TRANSACTIONS}!A1`, [
        [date, input.type, input.category, input.description, String(input.amount), statusTag],
      ]);
      return;
    } catch (err) {
      console.warn('[Finance] addTransactionDirect fallback -> sqlite:', (err as any)?.message ?? err);
    }
  }

  db.prepare(`
    INSERT INTO finance_transactions (date, type, category, description, amount, tags, paymentMethod, creditCardId, isEffective, effectiveAmount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  index: number,
  input: TransactionInput,
  source: TransactionSource = 'local',
): Promise<void> {
  const date = input.date ?? new Date().toISOString().split('T')[0];
  const spreadsheetId = getSpreadsheetId();

  if (source === 'sheets' && spreadsheetId) {
    try {
      const service = new SheetsService();
      const rowNum = index + 2; // A2 is index 0
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
  index: number,
  isEffective: boolean,
  actualAmount?: number,
  source: TransactionSource = 'local',
): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  const hasCustomAmount = Number.isFinite(actualAmount) && Number(actualAmount) > 0;
  const statusTag = !isEffective
    ? 'previsto'
    : (hasCustomAmount ? `efetivado:${Number(actualAmount).toFixed(2)}` : 'efetivado');

  if (source === 'sheets' && spreadsheetId) {
    try {
      const service = new SheetsService();
      const rowNum = index + 2; // A2 is index 0
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

  const current = db.prepare(`
    SELECT type, tags
    FROM finance_transactions
    WHERE id = ?
    LIMIT 1
  `).get(index) as { type?: string; tags?: string } | undefined;

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
    index,
  );
}

export async function deleteTransactionDirect(
  index: number,
  source: TransactionSource = 'local',
): Promise<void> {
  const spreadsheetId = getSpreadsheetId();

  if (source === 'sheets' && spreadsheetId) {
    try {
      const service = new SheetsService();
      const rowNum = index + 2; // A2 is index 0
      await service.clearRange(spreadsheetId, `${SHEET_NAMES.TRANSACTIONS}!A${rowNum}:F${rowNum}`);
      return;
    } catch (err) {
      console.warn('[Finance] deleteTransactionDirect sheets fallback -> sqlite:', (err as any)?.message ?? err);
    }
  }

  db.prepare('DELETE FROM finance_transactions WHERE id = ?').run(index);
}

export async function getDebts(): Promise<DebtRecord[]> {
  const spreadsheetId = getSpreadsheetId();
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
  const spreadsheetId = getSpreadsheetId();
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
  const spreadsheetId = getSpreadsheetId();
  if (source === 'sheets' && spreadsheetId) {
    try {
      const service = new SheetsService();
      const sheetRow = rowIndex + 2;
      await service.clearRange(spreadsheetId, `${SHEET_NAMES.DEBTS}!A${sheetRow}:G${sheetRow}`);
      return;
    } catch (err) {
      console.warn('[Finance] deleteDebt fallback -> sqlite:', (err as any)?.message ?? err);
    }
  }

  db.prepare('DELETE FROM finance_debts WHERE id = ?').run(rowIndex);
}

export async function getOverdueAccounts(): Promise<OverdueRecord[]> {
  const spreadsheetId = getSpreadsheetId();
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
        }))
        .filter(d => d.account.trim() !== '');
      if (fromSheets.length > 0) return fromSheets;
    } catch (err) {
      console.warn('[Finance] getOverdueAccounts fallback -> sqlite:', (err as any)?.message ?? err);
    }
  }

  const rows = db.prepare(`
    SELECT id, account, overdueAmount, daysOverdue, dueDate, registeredAt, status
    FROM finance_overdue_accounts
    ORDER BY id DESC
  `).all() as Array<any>;

  return rows.map(r => ({
    index: Number(r.id),
    source: 'local' as const,
    account: String(r.account ?? ''),
    overdueAmount: Number(r.overdueAmount ?? 0),
    daysOverdue: calculateDaysOverdue(String(r.dueDate ?? '')) || Number(r.daysOverdue ?? 0),
    dueDate: normalizeDate(String(r.dueDate ?? '')),
    registeredAt: String(r.registeredAt ?? ''),
    status: String(r.status ?? 'Pendente'),
  }));
}

export async function addOverdueAccount(input: OverdueInput): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
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
  rowIndex: number,
  source: TransactionSource = 'local',
): Promise<void> {
  const spreadsheetId = getSpreadsheetId();
  if (source === 'sheets' && spreadsheetId) {
    try {
      const service = new SheetsService();
      const sheetRow = rowIndex + 2;
      await service.clearRange(spreadsheetId, `${SHEET_NAMES.OVERDUE_ACCOUNTS}!A${sheetRow}:F${sheetRow}`);
      return;
    } catch (err) {
      console.warn('[Finance] deleteOverdueAccount fallback -> sqlite:', (err as any)?.message ?? err);
    }
  }

  db.prepare('DELETE FROM finance_overdue_accounts WHERE id = ?').run(rowIndex);
}

export async function payDebt(
  index: number,
  source: TransactionSource = 'local',
  mode: 'installment' | 'full' = 'installment',
  amount?: number,
): Promise<void> {
  const spreadsheetId = getSpreadsheetId();

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
  index: number,
  source: TransactionSource = 'local',
  mode: 'partial' | 'full' = 'partial',
  amount?: number,
): Promise<void> {
  const spreadsheetId = getSpreadsheetId();

  if (source === 'sheets' && spreadsheetId) {
    try {
      const service = new SheetsService();
      const rowNum = index + 2;
      const data = await service.readRange(spreadsheetId, `${SHEET_NAMES.OVERDUE_ACCOUNTS}!A${rowNum}:F${rowNum}`);
      const row = data.values[0] ?? [];
      if (!row[0]) throw new Error('Conta atrasada não encontrada');
      const account = String(row[0] ?? 'Conta atrasada');
      const overdueAmount = parseFloat(row[1] ?? '0') || 0;

      const paymentAmount = mode === 'full'
        ? overdueAmount
        : (amount && amount > 0 ? amount : 0);
      if (paymentAmount <= 0) throw new Error('Valor de pagamento inválido');

      const newAmount = Math.max(overdueAmount - paymentAmount, 0);
      if (newAmount <= 0) {
        await service.clearRange(spreadsheetId, `${SHEET_NAMES.OVERDUE_ACCOUNTS}!A${rowNum}:F${rowNum}`);
      } else {
        await service.writeRange(spreadsheetId, `${SHEET_NAMES.OVERDUE_ACCOUNTS}!A${rowNum}:F${rowNum}`, [[
          account,
          String(newAmount),
          String(calculateDaysOverdue(row[5] ?? '') || (parseInt(row[2] ?? '0') || 0)),
          row[3] ?? todayISO(),
          'Pendente',
          row[5] ?? '',
        ]]);
      }
      addLocalExpenseTransaction(`Pagamento conta atrasada - ${account}`, paymentAmount, 'Outros');
      return;
    } catch (err) {
      console.warn('[Finance] payOverdue sheets fallback -> sqlite:', (err as any)?.message ?? err);
    }
  }

  const current = db.prepare(`
    SELECT id, account, overdueAmount
    FROM finance_overdue_accounts
    WHERE id = ?
  `).get(index) as any;
  if (!current) throw new Error('Conta atrasada não encontrada');

  const overdueAmount = Number(current.overdueAmount ?? 0);
  const paymentAmount = mode === 'full'
    ? overdueAmount
    : (amount && amount > 0 ? amount : 0);
  if (paymentAmount <= 0) throw new Error('Valor de pagamento inválido');

  const newAmount = Math.max(overdueAmount - paymentAmount, 0);
  if (newAmount <= 0) {
    db.prepare('DELETE FROM finance_overdue_accounts WHERE id = ?').run(index);
  } else {
    db.prepare(`
      UPDATE finance_overdue_accounts
      SET overdueAmount = ?
      WHERE id = ?
    `).run(newAmount, index);
  }

  addLocalExpenseTransaction(`Pagamento conta atrasada - ${String(current.account ?? 'Conta atrasada')}`, paymentAmount, 'Outros');
}

export async function getRecurringExpenses(): Promise<RecurringExpenseRecord[]> {
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
