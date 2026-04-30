// Propaga receitas + plano mensal de MAIO/2026 para JUN-DEZ/2026 no Supabase.
// Idempotente: só cria se não existir um registro com mesma description+amount+date.
//
// Maio é a fonte de verdade (usuário ajustou manualmente):
//   - 7 receitas em 01/05/2026 totalizando R$ 9.758,00
//   - plannedIncome / plannedExpenses do plano mensal
//
// Strategy:
//   - Para cada mês de jun-dez:
//     - Para cada receita única de maio:
//       - Verifica se já existe (description + amount + date)
//       - Se não existe, cria com data ajustada (mantém o dia, ajusta para limites do mês)
//     - Tags: 'previsto' (não efetivado, usuário decidirá quando efetivar)

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

const SOURCE_MONTH = '2026-05';
const TARGET_MONTHS = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];

function lastDayOfMonth(yyyymm) {
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(y, m, 0).getDate(); // Date(year, month=1-indexed, 0) = last day of month-1
}

function adjustDateToMonth(sourceDate, targetMonth) {
  // sourceDate: '2026-05-15' → targetMonth: '2026-06' → '2026-06-15'
  // Se o dia não existe no mês alvo (ex: 31/02), clamp para o último dia.
  const day = parseInt(sourceDate.split('-')[2], 10);
  const maxDay = lastDayOfMonth(targetMonth);
  const adjustedDay = Math.min(day, maxDay);
  return `${targetMonth}-${String(adjustedDay).padStart(2, '0')}`;
}

async function main() {
  // 1. Pegar receitas de maio (fonte da verdade)
  console.log(`Lendo receitas de ${SOURCE_MONTH}...`);
  const { data: sourceRows, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('type', 'income')
    .gte('date', `${SOURCE_MONTH}-01`)
    .lt('date', `2026-06-01`);

  if (error) {
    console.error('Erro ao ler maio:', error.message);
    process.exit(1);
  }

  console.log(`${sourceRows.length} receitas encontradas em maio\n`);
  if (sourceRows.length === 0) {
    console.error('Nenhuma receita em maio para usar como template. Abortando.');
    process.exit(1);
  }

  // 2. Para cada mês alvo, criar receitas que não existem
  const totalToCreate = [];

  for (const targetMonth of TARGET_MONTHS) {
    console.log(`\n--- Processando ${targetMonth} ---`);

    // Verificar receitas existentes no mês alvo (lida com overflow Dez→Jan próximo ano)
    const [ty, tm] = targetMonth.split('-').map(Number);
    const nextY = tm === 12 ? ty + 1 : ty;
    const nextM = tm === 12 ? 1 : tm + 1;
    const ltDate = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

    const { data: existingRows, error: existErr } = await supabase
      .from('transactions')
      .select('id, description, amount, date')
      .eq('type', 'income')
      .gte('date', `${targetMonth}-01`)
      .lt('date', ltDate);

    if (existErr) {
      console.error(`  Erro ao ler ${targetMonth}:`, existErr.message);
      continue;
    }

    const existingKeys = new Set(
      existingRows.map(r => `${r.description}|${Number(r.amount).toFixed(2)}|${r.date}`)
    );

    let createdCount = 0;
    let skippedCount = 0;

    for (const src of sourceRows) {
      const targetDate = adjustDateToMonth(src.date, targetMonth);
      const key = `${src.description}|${Number(src.amount).toFixed(2)}|${targetDate}`;

      if (existingKeys.has(key)) {
        skippedCount++;
        continue;
      }

      // Tag 'previsto' (não efetivado) — usuário decidirá ao receber
      const newTags = ['previsto'];

      totalToCreate.push({
        date: targetDate,
        type: 'income',
        category: src.category,
        description: src.description,
        amount: Number(src.amount),
        tags: newTags,
      });
      createdCount++;
      existingKeys.add(key); // evitar duplicar dentro do mesmo mês
    }

    console.log(`  Para criar: ${createdCount} | Já existem (skip): ${skippedCount}`);
  }

  if (totalToCreate.length === 0) {
    console.log('\nNenhum registro para criar. Tudo já existe.');
    return;
  }

  // 3. Backup (mostra o que vai criar)
  const backupPath = resolve(__dirname, `../seed-preview-${Date.now()}.json`);
  writeFileSync(backupPath, JSON.stringify(totalToCreate, null, 2));
  console.log(`\nPreview salvo em: ${backupPath}`);
  console.log(`Total a criar: ${totalToCreate.length} receitas`);

  // 4. Inserir
  console.log('\nInserindo no Supabase...');
  const chunkSize = 50;
  let inserted = 0;
  for (let i = 0; i < totalToCreate.length; i += chunkSize) {
    const chunk = totalToCreate.slice(i, i + chunkSize);
    const { error: insErr } = await supabase.from('transactions').insert(chunk);
    if (insErr) {
      console.error(`Erro no batch ${i}:`, insErr.message);
      process.exit(1);
    }
    inserted += chunk.length;
    console.log(`  ${inserted}/${totalToCreate.length}`);
  }

  console.log(`\n✓ ${inserted} receitas criadas em jun-dez/2026`);

  // 5. Propagar plano mensal (plannedIncome / plannedExpenses) - se existe tabela monthly_plan no Supabase
  // (Mantemos local-only por enquanto — finance_monthly_plan é tabela SQLite)
  console.log('\nNota: plano mensal (finance_monthly_plan) é local SQLite — não propagado aqui.');
  console.log('Se precisar, ajuste pela UI em cada mês.');
}

main().catch(e => { console.error(e); process.exit(1); });
