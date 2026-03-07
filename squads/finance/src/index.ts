// Squad Financeiro — Tipos e interfaces compartilhadas

export type TransactionType = 'receita' | 'despesa';

export type ExpenseCategory =
  | 'Alimentação'
  | 'Moradia'
  | 'Transporte'
  | 'Saúde'
  | 'Lazer'
  | 'Educação'
  | 'Vestuário'
  | 'Tecnologia'
  | 'Assinaturas'
  | 'Outros';

export type IncomeCategory =
  | 'Salário'
  | 'Freelance'
  | 'Investimentos'
  | 'Aluguel Recebido'
  | 'Outros';

export type TransactionCategory = ExpenseCategory | IncomeCategory;

export interface Transaction {
  date: string;           // YYYY-MM-DD
  type: TransactionType;
  category: TransactionCategory;
  description: string;
  amount: number;
  tags?: string;
}

export interface BudgetItem {
  category: ExpenseCategory;
  monthlyBudget: number;
  spent: number;
  remaining: number;
  percentUsed: number;
}

export interface Debt {
  creditor: string;
  totalAmount: number;
  interestRate: number;  // % ao mês
  remainingInstallments: number;
  dueDay: number;
  monthlyPayment: number;
}

export interface FinancialGoal {
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;   // YYYY-MM
  percentProgress: number;
}

export interface FinancialProfile {
  monthlyFixedIncome: number;
  monthlyVariableIncome: number;
  fixedExpenses: Record<string, number>;  // categoria → valor
  debts: Debt[];
  goals: FinancialGoal[];
  monthlySavingsCapacity: number;
  financialHealthScore: number;  // 0-100
}

export interface DiagnosisResult {
  profile: FinancialProfile;
  healthScore: number;
  healthClassification: 'Crítico' | 'Preocupante' | 'Estável' | 'Saudável' | 'Excelente';
  criticalPoints: string[];
  actionPlan: ActionPlanItem[];
  suggestedBudget: Record<ExpenseCategory, number>;
  debtFreeEstimate?: string;  // "X meses" ou null se não há dívidas
}

export interface ActionPlanItem {
  priority: number;
  title: string;
  description: string;
  timeframe: string;
}

export type BudgetAlertLevel = 'warning' | 'critical';

export interface BudgetAlert {
  category: string;
  budgeted: number;
  spent: number;
  percentage: number;
  level: BudgetAlertLevel;
  message: string;
}

export type FinanceIntent =
  | 'record_transaction'
  | 'query_balance'
  | 'query_transactions'
  | 'set_budget'
  | 'generate_report'
  | 'diagnosis_answer'
  | 'debt_query'
  | 'goal_update'
  | 'general_question';

export interface FinanceMessageResponse {
  response: string;
  alerts: BudgetAlert[];
  spreadsheetUrl?: string;
  action?: string;
}

export interface OnboardingStep {
  step: number;
  question: string;
  field: string;
  hint?: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    step: 1,
    question: 'Qual é sua renda mensal líquida fixa? (salário, pró-labore ou renda principal após impostos)',
    field: 'monthlyFixedIncome',
    hint: 'Ex: R$ 5.000',
  },
  {
    step: 2,
    question: 'Você tem renda variável? (freelance, comissões, aluguéis...) Se sim, qual a média mensal? Se não, pode dizer "não tenho".',
    field: 'monthlyVariableIncome',
    hint: 'Ex: R$ 1.500 ou "não tenho"',
  },
  {
    step: 3,
    question: 'Quais são suas principais despesas fixas mensais? (aluguel, financiamento, plano de saúde, assinaturas...) Liste com valores aproximados.',
    field: 'fixedExpenses',
    hint: 'Ex: Aluguel R$1.200, Plano de saúde R$300, Netflix R$50',
  },
  {
    step: 4,
    question: 'Você possui dívidas? (cartão de crédito, empréstimos, financiamentos...) Se sim, liste quais são, os valores e as parcelas mensais. Se não tiver, diga "não tenho dívidas".',
    field: 'debts',
    hint: 'Ex: Cartão R$3.000 (parcela mínima R$200), Carro R$15.000 (R$800/mês)',
  },
  {
    step: 5,
    question: 'Qual é seu maior objetivo financeiro agora? (Ex: quitar dívidas, criar reserva de emergência, investir, comprar algo específico...)',
    field: 'primaryGoal',
    hint: 'Seja específico! Ex: "Quitar o cartão em 6 meses" ou "Ter R$10.000 de reserva"',
  },
  {
    step: 6,
    question: 'Quanto você consegue poupar por mês atualmente? (Mesmo que seja pouco ou zero, seja honesto!)',
    field: 'monthlySavingsCapacity',
    hint: 'Ex: R$500, R$0 ou "fico no negativo"',
  },
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Saúde',
  'Lazer',
  'Educação',
  'Vestuário',
  'Tecnologia',
  'Assinaturas',
  'Outros',
];

export const INCOME_CATEGORIES: IncomeCategory[] = [
  'Salário',
  'Freelance',
  'Investimentos',
  'Aluguel Recebido',
  'Outros',
];
