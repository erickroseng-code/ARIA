#!/usr/bin/env node

/**
 * Script de migração: SQLite → Supabase
 * Lê dados de dev.native.db e insere no Supabase
 */

require('dotenv').config({ path: '.env' });

const { DatabaseSync } = require('node:sqlite');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

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

let db;
try {
  db = new DatabaseSync(dbPath);
} catch (err) {
  console.error(`❌ Erro ao abrir SQLite em ${dbPath}:`, err.message);
  process.exit(1);
}

async function migrate() {
  try {
    console.log('🔄 Iniciando migração SQLite → Supabase...\n');
    console.log(`📂 Banco SQLite: ${dbPath}\n`);

    // ========== 1. Migrar Settings ==========
    console.log('⚙️  Migrando settings...');
    try {
      const settings = db.prepare('SELECT key, value FROM settings').all();
      if (settings.length > 0) {
        const { error } = await supabase.from('settings').insert(
          settings.map(s => ({ key: s.key, value: s.value }))
        );
        if (error) throw error;
        console.log(`  └─ ✅ ${settings.length} configurações inseridas`);
      } else {
        console.log('  └─ Nenhuma configuração encontrada');
      }
    } catch (err) {
      console.log(`  └─ ⚠️  Erro ao migrar settings:`, err.message);
    }

    // ========== 2. Migrar Integrations ==========
    console.log('🔑 Migrando integrations...');
    try {
      const integrations = db.prepare('SELECT provider, refreshToken, accessToken, isValid FROM integrations').all();
      if (integrations.length > 0) {
        const { error } = await supabase.from('integrations').insert(
          integrations.map(i => ({
            provider: i.provider,
            refresh_token: i.refreshToken,
            access_token: i.accessToken,
            is_valid: i.isValid,
          }))
        );
        if (error) throw error;
        console.log(`  └─ ✅ ${integrations.length} integrações inseridas`);
      } else {
        console.log('  └─ Nenhuma integração encontrada');
      }
    } catch (err) {
      console.log(`  └─ ⚠️  Erro ao migrar integrations:`, err.message);
    }

    // ========== 3. Migrar Transactions ==========
    console.log('📋 Migrando transactions...');
    try {
      const transactions = db.prepare(`
        SELECT date, type, category, description, amount, tags
        FROM finance_transactions
      `).all();

      if (transactions.length > 0) {
        const data = transactions.map(t => ({
          date: t.date,
          type: t.type === 'receita' ? 'income' : 'expense',
          category: t.category,
          description: t.description,
          amount: parseFloat(t.amount) || 0,
          tags: t.tags ? t.tags.split(',').map(x => x.trim()).filter(Boolean) : [],
        }));

        const { error } = await supabase.from('transactions').insert(data);
        if (error) throw error;
        console.log(`  └─ ✅ ${data.length} transações inseridas`);
      } else {
        console.log('  └─ Nenhuma transação encontrada');
      }
    } catch (err) {
      console.log(`  └─ ⚠️  Erro ao migrar transactions:`, err.message);
    }

    // ========== 4. Migrar Budget ==========
    console.log('💰 Migrando budget...');
    try {
      const budgets = db.prepare('SELECT category, budgeted FROM finance_budgets').all();
      if (budgets.length > 0) {
        const data = budgets.map(b => ({
          category: b.category,
          monthly_budget: parseFloat(b.budgeted) || 0,
        }));

        const { error } = await supabase.from('budget').insert(data);
        if (error) throw error;
        console.log(`  └─ ✅ ${data.length} orçamentos inseridos`);
      } else {
        console.log('  └─ Nenhum orçamento encontrado');
      }
    } catch (err) {
      console.log(`  └─ ⚠️  Erro ao migrar budget:`, err.message);
    }

    console.log('\n✅ Migração concluída com sucesso!');
    console.log('\n📝 Próximos passos:');
    console.log('1. Verificar dados no Supabase Dashboard');
    console.log('2. Fazer commit e push: git push origin master');
    console.log('3. Deploy no Render\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    process.exit(1);
  }
}

migrate();
