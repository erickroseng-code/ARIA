import { SheetsService } from '@aria/integrations';
import { getSpreadsheetId } from '../finance.service';
import { SHEET_NAMES } from '../sheets-schema';
import { db } from '../../../config/db';

function getCurrentMonth(): string {
  return new Date().toISOString().substring(0, 7);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS finance_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,
    category TEXT NOT NULL,
    budgeted REAL NOT NULL,
    UNIQUE(month, category)
  )
`);

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
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  db.prepare(`
    INSERT INTO finance_budgets (month, category, budgeted)
    VALUES (?, ?, ?)
    ON CONFLICT(month, category) DO UPDATE SET budgeted = excluded.budgeted
  `).run(getCurrentMonth(), category, amount);

  return `✅ Orçamento de **${category}** atualizado para ${fmt(amount)}.`;
}

/**
 * Retorna o resumo do orçamento do mês atual.
 */
export async function getBudgetSummary(): Promise<string> {
  const month = getCurrentMonth();
  
  const budgetRows = db.prepare(`
    SELECT category, budgeted FROM finance_budgets WHERE month = ?
  `).all(month) as Array<{ category: string; budgeted: number }>;

  const budgetMap: Record<string, number> = {};
  for (const row of budgetRows) {
    if (row.budgeted > 0) budgetMap[row.category] = row.budgeted;
  }

  const dashboardData = await import('./dashboard.js').then(m => m.getDashboardData(month));
  const spentMap: Record<string, number> = {};
  for (const entry of dashboardData.byCategory) {
    spentMap[entry.category] = entry.spent;
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
