#!/usr/bin/env node

/**
 * Script de migração: SQLite (local) → Supabase
 * Executa: npm run migrate (adicionar em package.json) ou node migrate-data.js
 */

require('dotenv').config();

const { DatabaseSync } = require('node:sqlite');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPath = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), '../..', 'dev.native.db');

console.log('🔄 Iniciando migração SQLite → Supabase...\n');
console.log(`📂 Banco SQLite: ${dbPath}`);
console.log(`☁️  Supabase: ${supabaseUrl}\n`);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurado');
  process.exit(1);
}

let db;
try {
  db = new DatabaseSync(dbPath);
  console.log('✅ SQLite conectado\n');
} catch (err) {
  console.error(`❌ Erro ao abrir SQLite:`, err.message);
  console.log('\n💡 Se não encontrar dev.native.db, rode localmente primeiro com: npm run dev');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function migrate() {
  try {
    // ========== 1. Transactions ==========
    console.log('📋 Migrando transactions...');
    try {
      const transactions = db.prepare(`
        SELECT date, type, category, description, amount, tags
        FROM finance_transactions
      `).all();

      if (transactions && transactions.length > 0) {
        const data = transactions.map(t => ({
          date: t.date,
          type: t.type === 'receita' ? 'income' : 'expense',
          category: t.category,
          description: t.description || '',
          amount: parseFloat(t.amount) || 0,
          tags: t.tags ? t.tags.split(',').map(x => x.trim()).filter(Boolean) : [],
        }));

        const { error } = await supabase.from('transactions').insert(data);
        if (error) throw error;
        console.log(`  ✅ ${data.length} transações`);
      } else {
        console.log('  └─ Nenhuma transação');
      }
    } catch (err) {
      console.log(`  ⚠️  ${err.message}`);
    }

    // ========== 2. Budget ==========
    console.log('💰 Migrando budget...');
    try {
      const budgets = db.prepare(`
        SELECT category, budgeted FROM finance_budgets
      `).all();

      if (budgets && budgets.length > 0) {
        const data = budgets.map(b => ({
          category: b.category,
          monthly_budget: parseFloat(b.budgeted) || 0,
        }));

        const { error } = await supabase.from('budget').insert(data);
        if (error) throw error;
        console.log(`  ✅ ${data.length} orçamentos`);
      } else {
        console.log('  └─ Nenhum orçamento');
      }
    } catch (err) {
      console.log(`  ⚠️  ${err.message}`);
    }

    // ========== 3. Settings ==========
    console.log('⚙️  Migrando settings...');
    try {
      const settings = db.prepare('SELECT key, value FROM settings').all();

      if (settings && settings.length > 0) {
        const { error } = await supabase.from('settings').insert(
          settings.map(s => ({ key: s.key, value: s.value }))
        );
        if (error) throw error;
        console.log(`  ✅ ${settings.length} configurações`);
      } else {
        console.log('  └─ Nenhuma configuração');
      }
    } catch (err) {
      console.log(`  ⚠️  ${err.message}`);
    }

    console.log('\n✅ Migração concluída!\n');
    console.log('📝 Próximos passos:');
    console.log('1. Verificar dados no Supabase Dashboard (Table Editor)');
    console.log('2. Testar API: /api/finance/dashboard');
    console.log('3. Enviar mensagem pelo Telegram\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
  }
}

migrate();
