import { SheetsService } from '@aria/integrations';
import {
  getOnboardingState,
  saveOnboardingState,
  setupSpreadsheet,
  getSpreadsheetId,
} from '../finance.service';
import { SHEET_NAMES } from '../sheets-schema';
import { llmChat } from './llm-client';

// Definição das perguntas de onboarding
const ONBOARDING_STEPS = [
  { step: 1, question: 'Qual é sua renda mensal líquida fixa? (salário, pró-labore ou renda principal após impostos)', field: 'monthlyFixedIncome', hint: 'Ex: R$ 5.000' },
  { step: 2, question: 'Você tem renda variável? (freelance, comissões, aluguéis...) Se sim, qual a média mensal? Se não, pode dizer "não tenho".', field: 'monthlyVariableIncome', hint: 'Ex: R$ 1.500 ou "não tenho"' },
  { step: 3, question: 'Quais são suas principais despesas fixas mensais? (aluguel, financiamento, plano de saúde, assinaturas...) Liste com valores aproximados.', field: 'fixedExpenses', hint: 'Ex: Aluguel R$1.200, Plano de saúde R$300, Netflix R$50' },
  { step: 4, question: 'Você possui dívidas? (cartão de crédito, empréstimos, financiamentos...) Se sim, liste quais são, os valores e as parcelas mensais. Se não tiver, diga "não tenho dívidas".', field: 'debts', hint: 'Ex: Cartão R$3.000 (parcela mínima R$200), Carro R$15.000 (R$800/mês)' },
  { step: 5, question: 'Qual é seu maior objetivo financeiro agora? (Ex: quitar dívidas, criar reserva de emergência, investir, comprar algo específico...)', field: 'primaryGoal', hint: 'Seja específico! Ex: "Quitar o cartão em 6 meses" ou "Ter R$10.000 de reserva"' },
  { step: 6, question: 'Quanto você consegue poupar por mês atualmente? (Mesmo que seja pouco ou zero, seja honesto!)', field: 'monthlySavingsCapacity', hint: 'Ex: R$500, R$0 ou "fico no negativo"' },
];

function extractJson<T>(raw: string): T {
  const text = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(text) as T; } catch { /* continue */ }
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]) as T; } catch { /* continue */ } }
  throw new Error('Não foi possível extrair JSON da resposta LLM');
}

interface DiagnosisResult {
  profile: {
    monthlyFixedIncome: number;
    monthlyVariableIncome: number;
    fixedExpenses: Record<string, number>;
    debts: Array<{ creditor: string; totalAmount: number; interestRate: number; remainingInstallments: number; dueDay: number; monthlyPayment: number }>;
    goals: Array<{ name: string; targetAmount: number; currentAmount: number; deadline: string; percentProgress: number }>;
    monthlySavingsCapacity: number;
    financialHealthScore: number;
  };
  healthScore: number;
  healthClassification: string;
  criticalPoints: string[];
  actionPlan: Array<{ priority: number; title: string; description: string; timeframe: string }>;
  suggestedBudget: Record<string, number>;
  debtFreeEstimate?: string;
}

/**
 * Processa a resposta do usuário na etapa atual do onboarding.
 */
export async function processOnboardingMessage(userMessage: string): Promise<{
  reply: string;
  completed: boolean;
  diagnosis?: DiagnosisResult;
  spreadsheetUrl?: string;
}> {
  const state = getOnboardingState();
  const currentStep = ONBOARDING_STEPS[state.step];

  const updatedAnswers = { ...state.answers, [currentStep.field]: userMessage };
  const nextStep = state.step + 1;

  if (nextStep < ONBOARDING_STEPS.length) {
    saveOnboardingState({ completed: false, step: nextStep, answers: updatedAnswers });
    const next = ONBOARDING_STEPS[nextStep];
    return {
      reply: `Entendido! **(${nextStep + 1}/${ONBOARDING_STEPS.length})**\n\n${next.question}${next.hint ? `\n\n_${next.hint}_` : ''}`,
      completed: false,
    };
  }

  // Todas as perguntas respondidas — gerar diagnóstico
  const diagnosis = await generateDiagnosis(updatedAnswers);
  const spreadsheetUrl = await populateSpreadsheet(diagnosis, updatedAnswers);

  saveOnboardingState({ completed: true, step: nextStep, answers: updatedAnswers });

  return {
    reply: formatDiagnosisReply(diagnosis, spreadsheetUrl),
    completed: true,
    diagnosis,
    spreadsheetUrl,
  };
}

async function generateDiagnosis(answers: Record<string, string>): Promise<DiagnosisResult> {
  const systemPrompt = `Você é um especialista em finanças pessoais brasileiro. Analise as informações e gere um diagnóstico em JSON. Responda APENAS com JSON válido, sem markdown.`;

  const userPrompt = `Analise as informações financeiras e retorne um JSON com o diagnóstico:

RENDA FIXA: ${answers.monthlyFixedIncome}
RENDA VARIÁVEL: ${answers.monthlyVariableIncome}
DESPESAS FIXAS: ${answers.fixedExpenses}
DÍVIDAS: ${answers.debts}
OBJETIVO: ${answers.primaryGoal}
POUPANÇA ATUAL: ${answers.monthlySavingsCapacity}

JSON esperado:
{
  "profile": {
    "monthlyFixedIncome": <número>,
    "monthlyVariableIncome": <número ou 0>,
    "fixedExpenses": { "<categoria>": <valor> },
    "debts": [{ "creditor": "<nome>", "totalAmount": <valor>, "interestRate": <% a.m.>, "remainingInstallments": <n>, "dueDay": <1-31>, "monthlyPayment": <valor> }],
    "goals": [{ "name": "<objetivo>", "targetAmount": <valor>, "currentAmount": 0, "deadline": "AAAA-MM", "percentProgress": 0 }],
    "monthlySavingsCapacity": <número>,
    "financialHealthScore": <0-100>
  },
  "healthScore": <0-100>,
  "healthClassification": "<Crítico|Preocupante|Estável|Saudável|Excelente>",
  "criticalPoints": ["<ponto>"],
  "actionPlan": [{ "priority": 1, "title": "<título>", "description": "<desc>", "timeframe": "<prazo>" }],
  "suggestedBudget": { "Alimentação": <val>, "Moradia": <val>, "Transporte": <val>, "Saúde": <val>, "Lazer": <val>, "Educação": <val>, "Vestuário": <val>, "Tecnologia": <val>, "Assinaturas": <val>, "Outros": <val> },
  "debtFreeEstimate": "<X meses ou null>"
}`;

  const raw = await llmChat(userPrompt, systemPrompt, 0);
  return extractJson<DiagnosisResult>(raw);
}

async function populateSpreadsheet(diagnosis: DiagnosisResult, answers: Record<string, string>): Promise<string> {
  let spreadsheetId = getSpreadsheetId();
  let spreadsheetUrl: string;

  if (!spreadsheetId) {
    const result = await setupSpreadsheet();
    spreadsheetId = result.spreadsheetId;
    spreadsheetUrl = result.spreadsheetUrl;
  } else {
    spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  }

  const service = new SheetsService();
  const today = new Date().toISOString().split('T')[0];
  const totalIncome = diagnosis.profile.monthlyFixedIncome + diagnosis.profile.monthlyVariableIncome;

  // Aba Perfil
  const profileRows = [
    [today, ''],
    [String(diagnosis.profile.monthlyFixedIncome), ''],
    [String(diagnosis.profile.monthlyVariableIncome), ''],
    [String(totalIncome), ''],
    [String(diagnosis.profile.monthlySavingsCapacity), ''],
    [String(diagnosis.healthScore), ''],
    [diagnosis.healthClassification, ''],
    ['', ''],
    [answers.primaryGoal || '', ''],
    [diagnosis.debtFreeEstimate || 'Sem dívidas', ''],
    ['', ''],
    [diagnosis.actionPlan.map(a => `${a.priority}. ${a.title}: ${a.description}`).join('\n'), ''],
  ];
  await service.writeRange(spreadsheetId, `${SHEET_NAMES.PROFILE}!A2:B13`, profileRows);

  // Aba Orçamento
  const budgetEntries = Object.entries(diagnosis.suggestedBudget);
  const budgetRows = budgetEntries.map(([cat, val]) => [cat, String(val), '', '', '']);
  await service.writeRange(spreadsheetId, `${SHEET_NAMES.BUDGET}!A2:E${1 + budgetRows.length}`, budgetRows);

  // Aba Dívidas
  if (diagnosis.profile.debts?.length > 0) {
    const debtRows = diagnosis.profile.debts.map(d => [
      d.creditor, String(d.totalAmount), String(d.interestRate),
      String(d.remainingInstallments), String(d.dueDay), String(d.monthlyPayment),
    ]);
    await service.appendRows(spreadsheetId, `${SHEET_NAMES.DEBTS}!A2`, debtRows);
  }

  // Aba Metas
  if (diagnosis.profile.goals?.length > 0) {
    const goalRows = diagnosis.profile.goals.map(g => [
      g.name, String(g.targetAmount), String(g.currentAmount), g.deadline, String(g.percentProgress),
    ]);
    await service.appendRows(spreadsheetId, `${SHEET_NAMES.GOALS}!A2`, goalRows);
  }

  // Aba Dashboard — valores iniciais
  const totalExpenses = Object.values(diagnosis.suggestedBudget).reduce((a, b) => a + b, 0);
  const month = new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
  await service.writeRange(spreadsheetId, `${SHEET_NAMES.DASHBOARD}!B2:B6`, [
    [month],
    [String(totalIncome)],
    [String(totalExpenses)],
    [String(totalIncome - totalExpenses)],
    [String(diagnosis.healthScore)],
  ]);

  return spreadsheetUrl!;
}

function formatDiagnosisReply(diagnosis: DiagnosisResult, spreadsheetUrl: string): string {
  const score = diagnosis.healthScore;
  const emoji = score >= 80 ? '🟢' : score >= 60 ? '🟡' : score >= 40 ? '🟠' : '🔴';

  let r = `## Diagnóstico Financeiro Concluído ${emoji}\n\n`;
  r += `**Índice de Saúde Financeira: ${score}/100 — ${diagnosis.healthClassification}**\n\n`;

  if (diagnosis.criticalPoints.length > 0) {
    r += `### ⚠️ Pontos Críticos\n`;
    diagnosis.criticalPoints.forEach(p => { r += `• ${p}\n`; });
    r += '\n';
  }

  r += `### 📋 Plano de Ação\n`;
  diagnosis.actionPlan.slice(0, 3).forEach(a => {
    r += `**${a.priority}. ${a.title}** _(${a.timeframe})_\n${a.description}\n\n`;
  });

  if (diagnosis.debtFreeEstimate) {
    r += `### 💳 Previsão para Quitar Dívidas\n${diagnosis.debtFreeEstimate}\n\n`;
  }

  r += `### 📊 Planilha Criada\n[Abrir no Google Sheets](${spreadsheetUrl})\n\n`;
  r += `---\n_Agora me diga quando gastar algo, pergunte seu saldo, defina orçamentos e muito mais!_`;
  return r;
}

export function getFirstOnboardingMessage(): string {
  const s = ONBOARDING_STEPS[0];
  return `Olá! Vou ser seu assistente financeiro pessoal. 🎯\n\nAntes de começarmos, preciso entender sua situação para criar um plano personalizado.\n\n**(1/${ONBOARDING_STEPS.length})** ${s.question}${s.hint ? `\n\n_${s.hint}_` : ''}`;
}
