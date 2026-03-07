import { SheetsService } from '@aria/integrations';
import { getSpreadsheetId } from '../finance.service';
import { SHEET_NAMES } from '../sheets-schema';

export interface BudgetAlert {
  category: string;
  budgeted: number;
  spent: number;
  percentage: number;
  level: 'warning' | 'critical';
  message: string;
}

/**
 * Verifica alertas de orçamento para o mês atual.
 * warning: >= 80%, critical: >= 100%
 */
export async function checkBudgetAlerts(spreadsheetId: string, month: string): Promise<BudgetAlert[]> {
  const service = new SheetsService();

  // Ler orçamento configurado
  const budgetData = await service.readRange(spreadsheetId, `${SHEET_NAMES.BUDGET}!A2:B100`);
  if (budgetData.values.length === 0) return [];

  const budgetMap: Record<string, number> = {};
  for (const row of budgetData.values) {
    const cat = row[0];
    const val = parseFloat(row[1] ?? '0') || 0;
    if (cat && val > 0) budgetMap[cat] = val;
  }

  if (Object.keys(budgetMap).length === 0) return [];

  // Ler transações do mês
  const txData = await service.readRange(spreadsheetId, `${SHEET_NAMES.TRANSACTIONS}!A2:F10000`);
  const spentMap: Record<string, number> = {};

  for (const row of txData.values) {
    if (!row[0]?.startsWith(month)) continue;
    if (row[1] !== 'despesa') continue;
    const cat = row[2] ?? 'Outros';
    const amount = parseFloat(row[4] ?? '0') || 0;
    spentMap[cat] = (spentMap[cat] ?? 0) + amount;
  }

  const alerts: BudgetAlert[] = [];
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  for (const [category, budgeted] of Object.entries(budgetMap)) {
    const spent = spentMap[category] ?? 0;
    const percentage = Math.round((spent / budgeted) * 100);

    if (percentage >= 100) {
      alerts.push({
        category, budgeted, spent, percentage,
        level: 'critical',
        message: `🚨 Limite de ${category} ultrapassado! Gasto: ${fmt(spent)} / Orçamento: ${fmt(budgeted)} (${percentage}%)`,
      });
    } else if (percentage >= 80) {
      alerts.push({
        category, budgeted, spent, percentage,
        level: 'warning',
        message: `⚠️ ${percentage}% do orçamento de ${category} usado este mês (${fmt(spent)} de ${fmt(budgeted)})`,
      });
    }
  }

  return alerts;
}

/**
 * Define ou atualiza o orçamento de uma categoria.
 */
export async function setBudget(category: string, amount: number): Promise<string> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return 'Planilha não configurada. Inicie o diagnóstico financeiro.';

  const service = new SheetsService();
  const data = await service.readRange(spreadsheetId, `${SHEET_NAMES.BUDGET}!A2:E100`);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Procurar linha existente para a categoria
  const rows = data.values;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0]?.toLowerCase() === category.toLowerCase()) {
      // Atualizar linha existente (coluna B = índice 1, base 1)
      const lineNum = i + 2; // +2: header + 1-based
      await service.writeRange(spreadsheetId, `${SHEET_NAMES.BUDGET}!B${lineNum}`, [[String(amount)]]);
      return `✅ Orçamento de **${category}** atualizado para ${fmt(amount)}.`;
    }
  }

  // Adicionar nova linha
  const nextLine = rows.length + 2;
  await service.writeRange(spreadsheetId, `${SHEET_NAMES.BUDGET}!A${nextLine}:E${nextLine}`, [
    [category, String(amount), '', '', ''],
  ]);
  return `✅ Orçamento de **${category}** definido para ${fmt(amount)}.`;
}

/**
 * Retorna o resumo do orçamento do mês atual.
 */
export async function getBudgetSummary(): Promise<string> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return 'Planilha não configurada.';

  const service = new SheetsService();
  const month = new Date().toISOString().substring(0, 7);

  const budgetData = await service.readRange(spreadsheetId, `${SHEET_NAMES.BUDGET}!A2:B100`);
  const txData = await service.readRange(spreadsheetId, `${SHEET_NAMES.TRANSACTIONS}!A2:F10000`);

  const budgetMap: Record<string, number> = {};
  for (const row of budgetData.values) {
    const cat = row[0];
    const val = parseFloat(row[1] ?? '0') || 0;
    if (cat && val > 0) budgetMap[cat] = val;
  }

  const spentMap: Record<string, number> = {};
  for (const row of txData.values) {
    if (!row[0]?.startsWith(month)) continue;
    if (row[1] !== 'despesa') continue;
    const cat = row[2] ?? 'Outros';
    spentMap[cat] = (spentMap[cat] ?? 0) + (parseFloat(row[4] ?? '0') || 0);
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const monthLabel = new Date(`${month}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const lines = Object.entries(budgetMap).map(([cat, budget]) => {
    const spent = spentMap[cat] ?? 0;
    const pct = Math.round((spent / budget) * 100);
    const bar = pct >= 100 ? '🔴' : pct >= 80 ? '🟡' : '🟢';
    return `${bar} **${cat}**: ${fmt(spent)} / ${fmt(budget)} (${pct}%)`;
  });

  if (lines.length === 0) return `Nenhum orçamento configurado. Me diga seu orçamento por categoria!`;

  return `## Orçamento — ${monthLabel}\n\n${lines.join('\n')}`;
}
