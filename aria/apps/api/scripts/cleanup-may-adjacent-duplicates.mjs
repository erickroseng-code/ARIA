// Limpa as 5 duplicatas restantes em maio (datas adjacentes 01-02 e 04-05)
// causadas pelo bug de timezone do auto-copy. Mantém o registro com tag mais
// completa (ex: 'efetivado' > 'previsto') ou o de menor id.
//
// Casos:
// 1. 2,5% Comissão Audryn  R$ 500    01/05 + 02/05
// 2. Erick | Helius        R$ 1500   01/05 + 02/05
// 3. Kibe Audryn           R$ 700    01/05 + 02/05
// 4. Salário Erick Mês Pety R$ 1600  01/05 + 02/05
// 5. Prever Sogra          R$ 50     04/05 + 05/05

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

const targets = [
  { description: '2,5% Comissão Audryn', amount: 500 },
  { description: 'Erick | Helius', amount: 1500 },
  { description: 'Kibe Audryn', amount: 700 },
  { description: 'Salário Erick Mês Pety', amount: 1600 },
  { description: 'Prever Sogra', amount: 50 },
];

function tagScore(tags) {
  // Prioriza tags mais "ricas" (efetivado > previsto)
  const t = Array.isArray(tags) ? tags.join(',').toLowerCase() : String(tags || '').toLowerCase();
  if (t.includes('efetivado:')) return 3; // efetivado com valor customizado
  if (t.includes('efetivado')) return 2;
  if (t.includes('previsto')) return 1;
  return 0;
}

async function main() {
  const { data: rows, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'income')
    .gte('date', '2026-05-01')
    .lt('date', '2026-06-01');

  if (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  }

  const backupPath = resolve(__dirname, `../backup-may-adjacent-${Date.now()}.json`);
  writeFileSync(backupPath, JSON.stringify(rows, null, 2));
  console.log(`Backup: ${backupPath}\n`);

  const idsToDelete = [];

  for (const target of targets) {
    const matches = rows.filter(r =>
      r.description === target.description &&
      Number(r.amount) === target.amount
    );

    if (matches.length <= 1) {
      console.log(`OK ${target.description} - ${matches.length} registro(s), nada a fazer`);
      continue;
    }

    // Ordenar: tags mais ricas primeiro, depois menor id
    const sorted = [...matches].sort((a, b) => {
      const scoreDiff = tagScore(b.tags) - tagScore(a.tags);
      if (scoreDiff !== 0) return scoreDiff;
      return String(a.id).localeCompare(String(b.id));
    });

    const keep = sorted[0];
    const remove = sorted.slice(1);

    console.log(`DUPL ${target.description} R$ ${target.amount}`);
    console.log(`  KEEP: id=${keep.id.slice(0, 8)}.. data=${keep.date} tags=${JSON.stringify(keep.tags)}`);
    for (const r of remove) {
      console.log(`  DEL : id=${r.id.slice(0, 8)}.. data=${r.date} tags=${JSON.stringify(r.tags)}`);
      idsToDelete.push(r.id);
    }
    console.log();
  }

  if (idsToDelete.length === 0) {
    console.log('Nada a deletar');
    return;
  }

  console.log(`Deletando ${idsToDelete.length} registros...`);
  const { error: delErr } = await supabase.from('transactions').delete().in('id', idsToDelete);
  if (delErr) {
    console.error('Erro DELETE:', delErr.message);
    process.exit(1);
  }
  console.log(`OK ${idsToDelete.length} duplicatas removidas`);
}

main().catch(e => { console.error(e); process.exit(1); });
