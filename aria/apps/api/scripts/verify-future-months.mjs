import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
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

const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];

for (const m of months) {
  const [y, mm] = m.split('-').map(Number);
  const nextY = mm === 12 ? y + 1 : y;
  const nextM = mm === 12 ? 1 : mm + 1;
  const { data, error } = await supabase
    .from('transactions')
    .select('id, description, amount, date, tags')
    .eq('type', 'income')
    .gte('date', `${m}-01`)
    .lt('date', `${nextY}-${String(nextM).padStart(2, '0')}-01`);
  if (error) { console.error(m, error.message); continue; }
  console.log(`\n=== ${m} (${data.length} receitas) ===`);
  for (const r of data) {
    console.log(`  ${r.date} R$ ${r.amount} | ${r.description} | tags=${JSON.stringify(r.tags)}`);
  }
}
