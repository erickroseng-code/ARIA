#!/usr/bin/env node

/**
 * Backfill não-destrutivo:
 * Cria no Supabase as despesas de "pagamento conta atrasada" que existirem no SQLite local
 * e ainda não existirem no Supabase.
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

for (const envPath of envPaths) {
  if (!fs.existsSync(envPath)) continue;
  dotenv.config({ path: envPath, override: false });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'dev.native.db');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let db;
try {
  db = new DatabaseSync(SQLITE_DB_PATH);
} catch (err) {
  console.error(`❌ Falha ao abrir SQLite: ${err.message}`);
  process.exit(1);
}

function isoOrToday(value) {
  const str = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const rows = db.prepare(`
    SELECT account, paidAmount, paidAt, registeredAt, status
    FROM finance_overdue_accounts
    WHERE status = 'Pago'
      AND paidAmount IS NOT NULL
      AND paidAmount > 0
    ORDER BY id ASC
  `).all();

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const description = `Pagamento conta atrasada - ${String(row.account ?? 'Conta atrasada')}`;
    const amount = Number(row.paidAmount ?? 0);
    const date = isoOrToday(row.paidAt || row.registeredAt);

    const existing = await supabase
      .from('transactions')
      .select('id')
      .eq('date', date)
      .eq('type', 'expense')
      .eq('category', 'Outros')
      .eq('description', description)
      .eq('amount', amount)
      .limit(1);

    if (existing.error) {
      throw new Error(`Erro consultando existente: ${existing.error.message}`);
    }
    if (existing.data && existing.data.length > 0) {
      skipped += 1;
      continue;
    }

    const created = await supabase
      .from('transactions')
      .insert({
        date,
        type: 'expense',
        category: 'Outros',
        description,
        amount,
        tags: ['efetivado', 'pagamento-atrasada'],
      });

    if (created.error) {
      throw new Error(`Erro inserindo transação: ${created.error.message}`);
    }
    inserted += 1;
  }

  console.log(`✅ Backfill concluído | inseridas=${inserted} | já_existiam=${skipped}`);
}

main().catch((err) => {
  console.error('❌ Backfill falhou:', err?.message || err);
  process.exit(1);
});
