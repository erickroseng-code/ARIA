/**
 * Script de Migração: SQLite → Supabase
 * Executa em produção no Render shell
 *
 * Uso:
 * - Local: npx ts-node apps/api/migrate.ts
 * - Render: render-cli run "npx ts-node apps/api/migrate.ts"
 */

import dotenv from 'dotenv';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPath = process.env.SQLITE_DB_PATH || path.resolve(process.cwd(), 'dev.native.db');

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurado');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let db: DatabaseSync;

async function migrate() {
  try {
    console.log('🔄 Iniciando migração SQLite → Supabase\n');
    console.log(`📂 Banco SQLite: ${dbPath}`);
    console.log(`☁️  Supabase: ${supabaseUrl}\n`);

    // Conectar SQLite
    try {
      db = new DatabaseSync(dbPath);
      console.log('✅ SQLite conectado\n');
    } catch (err: any) {
      console.error(`❌ Erro ao abrir SQLite: ${err.message}`);
      console.log('\n💡 Se em Render, certifique-se que SQLITE_DB_PATH aponta para um arquivo existente\n');
      process.exit(1);
    }

    let totalMigrated = 0;

    // ========== 1. Transactions ==========
    await migrateTransactions();

    // ========== 2. Budget ==========
    await migrateBudget();

    // ========== 3. Settings ==========
    await migrateSettings();

    console.log('\n✅ Migração concluída com sucesso!');
    console.log(`\n📊 Total migrado: ${totalMigrated} registros`);
    console.log('\n🔗 Próximos passos:');
    console.log('1. Verificar dados em: https://app.supabase.com → Table Editor');
    console.log('2. Testar API: /api/finance/dashboard');
    console.log('3. Validar no Telegram\n');

    process.exit(0);

    async function migrateTransactions() {
      console.log('📋 Migrando transactions...');
      try {
        const transactions = (db.prepare(`
          SELECT date, type, category, description, amount, tags
          FROM finance_transactions
        `).all() as any[]) || [];

        if (transactions.length === 0) {
          console.log('  └─ Nenhuma transação encontrada');
          return;
        }

        const data = transactions.map(t => ({
          date: t.date,
          type: t.type === 'receita' ? 'income' : 'expense',
          category: t.category,
          description: t.description || '',
          amount: parseFloat(t.amount) || 0,
          tags: t.tags ? t.tags.split(',').map((x: string) => x.trim()).filter(Boolean) : [],
        }));

        const { error } = await supabase.from('transactions').insert(data);
        if (error) throw error;

        totalMigrated += data.length;
        console.log(`  ✅ ${data.length} transações`);
      } catch (err: any) {
        console.log(`  ⚠️  ${err.message}`);
      }
    }

    async function migrateBudget() {
      console.log('💰 Migrando budget...');
      try {
        const budgets = (db.prepare(`
          SELECT category, budgeted FROM finance_budgets
        `).all() as any[]) || [];

        if (budgets.length === 0) {
          console.log('  └─ Nenhum orçamento encontrado');
          return;
        }

        const data = budgets.map(b => ({
          category: b.category,
          monthly_budget: parseFloat(b.budgeted) || 0,
        }));

        const { error } = await supabase.from('budget').insert(data);
        if (error) throw error;

        totalMigrated += data.length;
        console.log(`  ✅ ${data.length} orçamentos`);
      } catch (err: any) {
        console.log(`  ⚠️  ${err.message}`);
      }
    }

    async function migrateSettings() {
      console.log('⚙️  Migrando settings...');
      try {
        const settings = (db.prepare('SELECT key, value FROM settings').all() as any[]) || [];

        if (settings.length === 0) {
          console.log('  └─ Nenhuma configuração encontrada');
          return;
        }

        const { error } = await supabase.from('settings').insert(
          settings.map(s => ({ key: s.key, value: s.value }))
        );
        if (error) throw error;

        totalMigrated += settings.length;
        console.log(`  ✅ ${settings.length} configurações`);
      } catch (err: any) {
        console.log(`  ⚠️  ${err.message}`);
      }
    }
  } catch (error: any) {
    console.error('\n❌ Erro fatal na migração:', error.message);
    process.exit(1);
  }
}

migrate();
