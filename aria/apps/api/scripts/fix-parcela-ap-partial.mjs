// Corrige retroativamente a conta "Parcela AP" R$ 1550 que foi paga parcialmente
// em 09/04/2026 (R$ 800 - saldo restante R$ 750).
// Atualiza no Supabase: status="Parcialmente Paga", paid_amount=800, paid_at='2026-04-09'

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

// Conta com status 'Pago' que na verdade foi pagamento parcial (R$ 800 de R$ 1550)
const accountId = '51200b51-3508-41f5-b2a7-6aa6503d5c98';

console.log('Buscando conta atual...');
const { data: before } = await supabase
  .from('overdue_accounts')
  .select('*')
  .eq('id', accountId)
  .single();
console.log('ANTES:', JSON.stringify(before, null, 2));

console.log('\nAtualizando para Parcialmente Paga (R$ 800 de R$ 1550)...');
const { error } = await supabase
  .from('overdue_accounts')
  .update({
    status: 'Parcialmente Paga',
    paid_amount: 800,
    paid_at: '2026-04-09',
  })
  .eq('id', accountId);

if (error) {
  console.error('Erro:', error.message);
  process.exit(1);
}

const { data: after } = await supabase
  .from('overdue_accounts')
  .select('*')
  .eq('id', accountId)
  .single();
console.log('\nDEPOIS:', JSON.stringify(after, null, 2));
console.log('\nOK - Saldo restante: R$', 1550 - 800);
