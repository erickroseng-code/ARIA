// Limpa contas atrasadas duplicadas pelo bug do carryoverOverdueAccountsForMonth.
// Remove qualquer registro cujo account_name contenha "(ref:" — pois esse padrão
// só existe em carryovers gerados automaticamente.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../../.env');
let envContent = readFileSync(envPath, 'utf-8');
if (envContent.charCodeAt(0) === 0xFEFF) envContent = envContent.slice(1);
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (m) {
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    env[m[1]] = val;
  }
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: rows, error } = await supabase.from('overdue_accounts').select('*');
if (error) { console.error(error); process.exit(1); }

const toDelete = rows.filter(r => String(r.account_name ?? '').includes('(ref:'));

const backupPath = resolve(__dirname, `../backup-overdue-carryover-${Date.now()}.json`);
writeFileSync(backupPath, JSON.stringify(toDelete, null, 2));
console.log(`Backup: ${backupPath}\n`);
console.log(`Vai deletar ${toDelete.length} contas com "(ref:" no nome:`);
for (const r of toDelete.slice(0, 5)) {
  console.log(`  R$ ${r.overdue_amount} | ${r.account_name?.substring(0, 60)}...`);
}
if (toDelete.length > 5) console.log(`  ... e mais ${toDelete.length - 5}`);

if (toDelete.length === 0) { console.log('Nada a fazer'); process.exit(0); }

const ids = toDelete.map(r => r.id);
const chunkSize = 100;
let deleted = 0;
for (let i = 0; i < ids.length; i += chunkSize) {
  const chunk = ids.slice(i, i + chunkSize);
  const { error: delErr } = await supabase.from('overdue_accounts').delete().in('id', chunk);
  if (delErr) { console.error(delErr); process.exit(1); }
  deleted += chunk.length;
}
console.log(`\nOK ${deleted} deletados`);

// Verificar restantes
const { data: remaining } = await supabase.from('overdue_accounts').select('id, account_name, overdue_amount, status');
console.log(`\n${remaining?.length ?? 0} contas restantes:`);
for (const r of (remaining ?? [])) {
  console.log(`  R$ ${r.overdue_amount} | ${r.status} | ${r.account_name}`);
}
