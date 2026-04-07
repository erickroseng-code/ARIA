import { llmChat } from './llm-client';
import { SheetsService } from '@aria/integrations';
import { getSpreadsheetId } from '../finance.service';
import { SHEET_NAMES } from '../sheets-schema';
import { checkBudgetAlerts, type BudgetAlert } from './budget-planner';


export interface ReportData {
  month: string;
  monthLabel: string;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  byCategory: Array<{ category: string; budgeted: number; spent: number; percentage: number }>;
  transactions: Array<{ date: string; type: string; category: string; description: string; amount: number }>;
  alerts: BudgetAlert[];
  aiAnalysis: string;
  topRecommendations: string[];
}

/**
 * Gera os dados do relatório financeiro de um mês.
 */
export async function generateReportData(month?: string): Promise<ReportData> {
  const spreadsheetId = await getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Planilha não configurada');

  const targetMonth = month ?? new Date().toISOString().substring(0, 7);
  const service = new SheetsService();

  const txData = await service.readRange(spreadsheetId, `${SHEET_NAMES.TRANSACTIONS}!A2:F10000`);
  const budgetData = await service.readRange(spreadsheetId, `${SHEET_NAMES.BUDGET}!A2:B100`);

  const budgetMap: Record<string, number> = {};
  for (const row of budgetData.values) {
    if (row[0] && row[1]) budgetMap[row[0]] = parseFloat(row[1]) || 0;
  }

  const rows = txData.values.filter(r => r[0]?.startsWith(targetMonth));
  let totalIncome = 0;
  let totalExpenses = 0;
  const spentMap: Record<string, number> = {};
  const transactions: ReportData['transactions'] = [];

  for (const row of rows) {
    const amount = parseFloat(row[4] ?? '0') || 0;
    const type = row[1];
    const category = row[2] ?? 'Outros';

    transactions.push({
      date: row[0], type, category, description: row[3] ?? '', amount,
    });

    if (type === 'receita') {
      totalIncome += amount;
    } else {
      totalExpenses += amount;
      spentMap[category] = (spentMap[category] ?? 0) + amount;
    }
  }

  const byCategory = Object.entries({ ...budgetMap, ...spentMap }).map(([category]) => {
    const budgeted = budgetMap[category] ?? 0;
    const spent = spentMap[category] ?? 0;
    return {
      category,
      budgeted,
      spent,
      percentage: budgeted > 0 ? Math.round((spent / budgeted) * 100) : 0,
    };
  }).sort((a, b) => b.spent - a.spent);

  const alerts = await checkBudgetAlerts(spreadsheetId, targetMonth);

  // Análise LLM
  const { aiAnalysis, topRecommendations } = await generateAiAnalysis(
    targetMonth, totalIncome, totalExpenses, byCategory, alerts,
  );

  const monthLabel = new Date(`${targetMonth}-01`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Salvar aba de relatório na planilha
  await saveReportSheet(spreadsheetId, service, targetMonth, {
    totalIncome, totalExpenses, netBalance: totalIncome - totalExpenses,
    byCategory, aiAnalysis, monthLabel,
  });

  return {
    month: targetMonth,
    monthLabel,
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
    byCategory,
    transactions,
    alerts,
    aiAnalysis,
    topRecommendations,
  };
}

async function generateAiAnalysis(
  month: string,
  totalIncome: number,
  totalExpenses: number,
  byCategory: ReportData['byCategory'],
  alerts: BudgetAlert[],
): Promise<{ aiAnalysis: string; topRecommendations: string[] }> {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const prompt = `Analise o mês ${month}:
Receitas: ${fmt(totalIncome)} | Despesas: ${fmt(totalExpenses)} | Saldo: ${fmt(totalIncome - totalExpenses)}
Categorias: ${byCategory.map(c => `${c.category}: ${fmt(c.spent)} (${c.percentage}% do orçamento)`).join(', ')}
Alertas: ${alerts.map(a => a.message).join('; ') || 'Nenhum'}

Escreva:
1. Um parágrafo de análise financeira (3-4 frases, objetivo e direto)
2. Top 3 recomendações para o próximo mês (1 frase cada)

Formato:
ANÁLISE: <parágrafo>
REC1: <recomendação 1>
REC2: <recomendação 2>
REC3: <recomendação 3>`;

  try {
    const text = await llmChat(
      prompt,
      'Você é um consultor financeiro pessoal brasileiro. Seja direto e prático.',
      0.5,
    );
    const analysisMatch = text.match(/ANÁLISE:\s*([\s\S]+?)(?=REC1:|$)/);
    const rec1 = text.match(/REC1:\s*(.+)/)?.[1]?.trim() ?? '';
    const rec2 = text.match(/REC2:\s*(.+)/)?.[1]?.trim() ?? '';
    const rec3 = text.match(/REC3:\s*(.+)/)?.[1]?.trim() ?? '';

    return {
      aiAnalysis: analysisMatch?.[1]?.trim() ?? text.trim(),
      topRecommendations: [rec1, rec2, rec3].filter(Boolean),
    };
  } catch {
    return {
      aiAnalysis: 'Análise não disponível.',
      topRecommendations: [],
    };
  }
}

async function saveReportSheet(
  spreadsheetId: string,
  service: SheetsService,
  month: string,
  data: { totalIncome: number; totalExpenses: number; netBalance: number; byCategory: ReportData['byCategory']; aiAnalysis: string; monthLabel: string },
): Promise<void> {
  const sheetName = `Relatório ${data.monthLabel}`;
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  try {
    await service.addSheet(spreadsheetId, sheetName);
  } catch {
    // Aba já existe — ok
  }

  const rows: string[][] = [
    ['RELATÓRIO FINANCEIRO — ' + data.monthLabel.toUpperCase(), ''],
    ['', ''],
    ['RESUMO', ''],
    ['Total Receitas', fmt(data.totalIncome)],
    ['Total Despesas', fmt(data.totalExpenses)],
    ['Saldo Líquido', fmt(data.netBalance)],
    ['', ''],
    ['ORÇAMENTO VS REALIZADO', ''],
    ['Categoria', 'Orçamento', 'Gasto', '% Usado'],
    ...data.byCategory.map(c => [c.category, fmt(c.budgeted), fmt(c.spent), `${c.percentage}%`]),
    ['', ''],
    ['ANÁLISE', ''],
    [data.aiAnalysis, ''],
  ];

  await service.writeRange(spreadsheetId, `${sheetName}!A1`, rows);
}
