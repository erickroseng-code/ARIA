// Script defensivo: limpa duplicatas de receitas em maio no Supabase
// Mantém o registro com menor created_at (ou menor id) por (description, amount, date)
// Faz backup em arquivo JSON antes de qualquer DELETE.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carrega .env manualmente (lida com BOM UTF-8)
const envPath = resolve(__dirname, '../../../.env');
let envContent = readFileSync(envPath, 'utf-8');
if (envContent.charCodeAt(0) === 0xFEFF) envContent = envContent.slice(1);
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) {
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[m[1]] = val;
  }
}

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env');
  console.error('Vars carregadas:', Object.keys(env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log('🔍 Buscando receitas em maio/2026 no Supabase...\n');

  const { data: rows, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'income')
    .gte('date', '2026-05-01')
    .lt('date', '2026-06-01')
    .order('date', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.error('❌ Erro ao buscar:', error.message);
    process.exit(1);
  }

  console.log(`📊 Total de receitas em maio: ${rows.length}\n`);

  // Backup completo
  const backupPath = resolve(__dirname, `../backup-supabase-may-income-${Date.now()}.json`);
  writeFileSync(backupPath, JSON.stringify(rows, null, 2));
  console.log(`💾 Backup salvo em: ${backupPath}\n`);

  // Agrupar por (description, amount, date) e identificar duplicatas
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.description}|${row.amount}|${row.date}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const toDelete = [];
  const kept = [];
  for (const [key, group] of groups) {
    if (group.length > 1) {
      // Manter o primeiro (menor id), deletar o resto
      const sorted = [...group].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (aTime !== bTime) return aTime - bTime;
        return String(a.id).localeCompare(String(b.id));
      });
      kept.push(sorted[0]);
      toDelete.push(...sorted.slice(1));
    } else {
      kept.push(group[0]);
    }
  }

  console.log(`✅ Únicos a manter: ${kept.length}`);
  console.log(`🗑️  Duplicatas a deletar: ${toDelete.length}\n`);

  if (toDelete.length === 0) {
    console.log('✨ Nada para deletar. Banco já limpo!');
    return;
  }

  // Mostrar resumo
  const summary = {};
  for (const row of toDelete) {
    const k = row.description;
    summary[k] = (summary[k] || 0) + 1;
  }
  console.log('Duplicatas por descrição:');
  for (const [desc, cnt] of Object.entries(summary)) {
    console.log(`  ${cnt}x | ${desc}`);
  }
  console.log();

  // DELETE em batch
  const idsToDelete = toDelete.map(r => r.id);
  console.log(`🗑️  Deletando ${idsToDelete.length} registros...\n`);

  // Supabase aceita até ~1000 ids por chamada via .in()
  const chunkSize = 100;
  let deleted = 0;
  for (let i = 0; i < idsToDelete.length; i += chunkSize) {
    const chunk = idsToDelete.slice(i, i + chunkSize);
    const { error: delErr } = await supabase
      .from('transactions')
      .delete()
      .in('id', chunk);
    if (delErr) {
      console.error(`❌ Erro no batch ${i}:`, delErr.message);
      process.exit(1);
    }
    deleted += chunk.length;
    console.log(`  ✓ Deletados ${deleted}/${idsToDelete.length}`);
  }

  console.log(`\n✅ ${deleted} duplicatas removidas com sucesso!`);
  console.log(`📊 Receitas restantes em maio: ${kept.length}`);
}

main().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
