#!/usr/bin/env node

/**
 * Sincroniza SQLite local -> Supabase (one-way).
 *
 * Objetivo:
 * - Manter a UX local rapida (SQLite)
 * - Publicar os dados para o Supabase quando quiser refletir no Telegram/Render
 *
 * Uso:
 *   npm run sync:supabase
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { DatabaseSync } = require('node:sqlite');
const { createClient } = require('@supabase/supabase-js');

const envPaths = Array.from(new Set([
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
  path.resolve(process.cwd(), '../../../.env'),
]));

const loadedEnvFiles = [];
for (const envPath of envPaths) {
  if (!fs.existsSync(envPath)) continue;
  dotenv.config({ path: envPath, override: false });
  loadedEnvFiles.push(envPath);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'dev.native.db');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes.');
  console.error(`📄 .env carregado(s): ${loadedEnvFiles.length ? loadedEnvFiles.join(', ') : '(nenhum)'}`);
  process.exit(1);
}

try {
  new URL(SUPABASE_URL);
} catch {
  console.error(`❌ SUPABASE_URL invalida: ${SUPABASE_URL}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let db;
try {
  db = new DatabaseSync(SQLITE_DB_PATH);
} catch (err) {
  console.error(`❌ Falha ao abrir SQLite (${SQLITE_DB_PATH}): ${err.message}`);
  process.exit(1);
}

function sqliteTableExists(tableName) {
  const row = db.prepare('SELECT name FROM sqlite_master WHERE type = ? AND name = ?').get('table', tableName);
  return !!row;
}

function normalizeDate(value) {
  const str = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toTagsArray(tags) {
  const raw = String(tags ?? '').trim();
  if (!raw) return [];
  return raw.split(',').map((x) => x.trim()).filter(Boolean);
}

function mapStatusPt(value) {
  const status = String(value ?? '').trim().toLowerCase();
  if (status === 'pago' || status === 'resolved') return 'Pago';
  if (status === 'pendente' || status === 'pending') return 'Pendente';
  return 'Pendente';
}

async function remoteTableExists(tableName) {
  const { error } = await supabase.from(tableName).select('*', { head: true, count: 'exact' }).limit(1);
  if (!error) return true;
  const msg = String(error.message || '');
  if (
    msg.includes('Could not find the table') ||
    msg.includes('does not exist') ||
    msg.includes('relation') && msg.includes('does not exist')
  ) {
    return false;
  }
  throw error;
}

async function clearById(tableName) {
  const { error } = await supabase.from(tableName).delete().not('id', 'is', null);
  if (error) throw error;
}

async function insertInChunks(tableName, rows, chunkSize = 500) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(tableName).insert(chunk);
    if (error) throw error;
  }
}

async function upsertInChunks(tableName, rows, onConflict, chunkSize = 500) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from(tableName)
      .upsert(chunk, { onConflict, ignoreDuplicates: false });
    if (error) throw error;
  }
}

async function syncSettings() {
  if (!sqliteTableExists('settings')) {
    console.log('  - settings: tabela local nao existe (skip)');
    return 0;
  }
  const settings = db.prepare('SELECT key, value FROM settings').all();
  await upsertInChunks('settings', settings.map((s) => ({ key: s.key, value: String(s.value ?? '') })), 'key');
  return settings.length;
}

async function syncIntegrations() {
  if (!sqliteTableExists('integrations')) {
    console.log('  - integrations: tabela local nao existe (skip)');
    return 0;
  }
  const integrations = db.prepare('SELECT provider, refreshToken, accessToken, isValid FROM integrations').all();
  const payload = integrations.map((i) => ({
    provider: String(i.provider ?? ''),
    refresh_token: i.refreshToken ?? null,
    access_token: i.accessToken ?? null,
    is_valid: Number(i.isValid ?? 1) === 1,
  }));
  await upsertInChunks('integrations', payload, 'provider');
  return payload.length;
}

async function syncBudget() {
  if (!sqliteTableExists('finance_budgets')) {
    console.log('  - budget: tabela local nao existe (skip)');
    return 0;
  }
  const rows = db.prepare('SELECT category, budgeted FROM finance_budgets').all();
  const payload = rows.map((r) => ({
    category: String(r.category ?? ''),
    monthly_budget: Number(r.budgeted ?? 0),
  }));
  await upsertInChunks('budget', payload, 'category');
  return payload.length;
}

async function syncTransactionsReplace() {
  if (!sqliteTableExists('finance_transactions')) {
    console.log('  - transactions: tabela local nao existe (skip)');
    return 0;
  }
  const rows = db.prepare(`
    SELECT date, type, category, description, amount, tags
    FROM finance_transactions
    ORDER BY id ASC
  `).all();

  const payload = rows.map((r) => ({
    date: normalizeDate(r.date) || todayISO(),
    type: String(r.type) === 'receita' ? 'income' : 'expense',
    category: String(r.category ?? ''),
    description: String(r.description ?? ''),
    amount: Number(r.amount ?? 0),
    tags: toTagsArray(r.tags),
  }));

  await clearById('transactions');
  await insertInChunks('transactions', payload);
  return payload.length;
}

async function syncOverdueReplace() {
  if (!sqliteTableExists('finance_overdue_accounts')) {
    console.log('  - overdue_accounts: tabela local nao existe (skip)');
    return 0;
  }
  if (!(await remoteTableExists('overdue_accounts'))) {
    console.log('  - overdue_accounts: tabela remota nao existe (skip)');
    return 0;
  }

  const rows = db.prepare(`
    SELECT account, overdueAmount, daysOverdue, dueDate, registeredAt, status, paidAmount, paidAt, paidTransactionId
    FROM finance_overdue_accounts
    ORDER BY id ASC
  `).all();

  const payload = rows.map((r) => ({
    account_name: String(r.account ?? ''),
    overdue_amount: Number(r.overdueAmount ?? 0),
    days_overdue: Number(r.daysOverdue ?? 0),
    registration_date: normalizeDate(r.registeredAt) || todayISO(),
    status: mapStatusPt(r.status),
  }));

  await clearById('overdue_accounts');
  await insertInChunks('overdue_accounts', payload);
  return payload.length;
}

async function syncRecurringReplace() {
  if (!sqliteTableExists('finance_recurring_expenses')) {
    console.log('  - recurring_expenses: tabela local nao existe (skip)');
    return 0;
  }
  if (!(await remoteTableExists('recurring_expenses'))) {
    console.log('  - recurring_expenses: tabela remota nao existe (skip)');
    return 0;
  }

  const rows = db.prepare(`
    SELECT description, category, amount, dayOfMonth, startMonth, active, lastAppliedMonth
    FROM finance_recurring_expenses
    ORDER BY id ASC
  `).all();

  const payload = rows.map((r) => ({
    description: String(r.description ?? ''),
    category: String(r.category ?? ''),
    amount: Number(r.amount ?? 0),
    day_of_month: Number(r.dayOfMonth ?? 1),
    start_month: String(r.startMonth ?? ''),
    active: Number(r.active ?? 1) === 1,
    last_applied_month: r.lastAppliedMonth ? String(r.lastAppliedMonth) : null,
  }));

  await clearById('recurring_expenses');
  await insertInChunks('recurring_expenses', payload);
  return payload.length;
}

async function syncDebtsReplace() {
  if (!sqliteTableExists('finance_debts')) {
    console.log('  - debts: tabela local nao existe (skip)');
    return 0;
  }
  if (!(await remoteTableExists('debts'))) {
    console.log('  - debts: tabela remota nao existe (skip)');
    return 0;
  }

  const rows = db.prepare(`
    SELECT creditor, totalAmount, interestRate, remainingInstallments, dueDay, monthlyInstallment
    FROM finance_debts
    ORDER BY id ASC
  `).all();

  const payload = rows.map((r) => ({
    creditor: String(r.creditor ?? ''),
    total_amount: Number(r.totalAmount ?? 0),
    interest_rate: Number(r.interestRate ?? 0),
    remaining_installments: Number(r.remainingInstallments ?? 0),
    due_day: Number(r.dueDay ?? 0),
    monthly_payment: Number(r.monthlyInstallment ?? 0),
  }));

  await clearById('debts');
  await insertInChunks('debts', payload);
  return payload.length;
}

async function main() {
  console.log('🔄 Sync SQLite local -> Supabase (one-way)\n');
  console.log(`📂 SQLite: ${SQLITE_DB_PATH}`);
  console.log(`☁️  Supabase: ${SUPABASE_URL}`);
  console.log(`📄 .env: ${loadedEnvFiles.length ? loadedEnvFiles.join(', ') : '(nenhum)'}\n`);
  console.log('⚠️  Modo: replace em tabelas operacionais (transactions/overdue/recurring/debts)\n');

  const counters = {
    settings: 0,
    integrations: 0,
    budget: 0,
    transactions: 0,
    overdue_accounts: 0,
    recurring_expenses: 0,
    debts: 0,
  };

  try {
    console.log('1) settings');
    counters.settings = await syncSettings();
    console.log(`   ✅ ${counters.settings}`);

    console.log('2) integrations');
    counters.integrations = await syncIntegrations();
    console.log(`   ✅ ${counters.integrations}`);

    console.log('3) budget');
    counters.budget = await syncBudget();
    console.log(`   ✅ ${counters.budget}`);

    console.log('4) transactions (replace)');
    counters.transactions = await syncTransactionsReplace();
    console.log(`   ✅ ${counters.transactions}`);

    console.log('5) overdue_accounts (replace)');
    counters.overdue_accounts = await syncOverdueReplace();
    console.log(`   ✅ ${counters.overdue_accounts}`);

    console.log('6) recurring_expenses (replace)');
    counters.recurring_expenses = await syncRecurringReplace();
    console.log(`   ✅ ${counters.recurring_expenses}`);

    console.log('7) debts (replace)');
    counters.debts = await syncDebtsReplace();
    console.log(`   ✅ ${counters.debts}`);

    const total = Object.values(counters).reduce((acc, n) => acc + n, 0);
    console.log('\n✅ Sync concluido');
    console.log(`📊 Total de linhas sincronizadas: ${total}`);
    console.log('📌 Agora o Telegram/Render deve refletir os dados apos o proximo request.');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Falha no sync:', err?.message || err);
    process.exit(1);
  }
}

main();
