// Remove receitas em junho/2026 com formato ANTIGO (não tem "|").
// Mantém apenas as no formato novo "Pessoa | Descrição".

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

const oldFormatNames = [
  'Kibe Audryn',
  '2,5% Comissão Audryn',
  'Salário Erick Mês Pety',
  'Salário Erick (Rede Social Pety)',
  'Salário Audryn (Gerências e afins)',
];

const { data: rows, error } = await supabase
  .from('transactions')
  .select('*')
  .eq('type', 'income')
  .gte('date', '2026-06-01')
  .lt('date', '2026-07-01');

if (error) { console.error(error); process.exit(1); }

const toDelete = rows.filter(r => oldFormatNames.includes(r.description));
const backupPath = resolve(__dirname, `../backup-june-old-format-${Date.now()}.json`);
writeFileSync(backupPath, JSON.stringify(toDelete, null, 2));
console.log(`Backup: ${backupPath}\n`);
console.log(`Vai deletar ${toDelete.length} registros formato antigo:`);
for (const r of toDelete) {
  console.log(`  ${r.date} R$ ${r.amount} | ${r.description}`);
}

if (toDelete.length === 0) { console.log('Nada a fazer'); process.exit(0); }

const ids = toDelete.map(r => r.id);
const { error: delErr } = await supabase.from('transactions').delete().in('id', ids);
if (delErr) { console.error(delErr); process.exit(1); }
console.log(`\nOK ${ids.length} deletados`);
