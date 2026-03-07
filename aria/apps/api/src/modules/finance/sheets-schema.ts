// Estrutura do Google Sheets — Cérebro Financeiro da ARIA

export const SHEET_NAMES = {
  TRANSACTIONS: 'Transações',
  BUDGET: 'Orçamento',
  DEBTS: 'Dívidas',
  GOALS: 'Metas',
  DASHBOARD: 'Dashboard',
  PROFILE: 'Perfil',
} as const;

export const SHEET_HEADERS = {
  [SHEET_NAMES.TRANSACTIONS]: [
    ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor (R$)', 'Tags'],
  ],
  [SHEET_NAMES.BUDGET]: [
    ['Categoria', 'Orçamento Mensal (R$)', 'Gasto no Mês (R$)', 'Saldo (R$)', '% Utilizado'],
  ],
  [SHEET_NAMES.DEBTS]: [
    ['Credor', 'Valor Total (R$)', 'Taxa Juros (% a.m.)', 'Parcelas Restantes', 'Vencimento (dia)', 'Parcela Mensal (R$)'],
  ],
  [SHEET_NAMES.GOALS]: [
    ['Meta', 'Valor Alvo (R$)', 'Valor Atual (R$)', 'Prazo (MM/AAAA)', '% Progresso'],
  ],
  [SHEET_NAMES.DASHBOARD]: [
    ['Indicador', 'Valor'],
    ['Mês de Referência', ''],
    ['Total Receitas', ''],
    ['Total Despesas', ''],
    ['Saldo Líquido', ''],
    ['Índice de Saúde Financeira', ''],
    ['Maior Gasto do Mês', ''],
    ['Categoria com Alerta', ''],
    ['', ''],
    ['Resumo por Categoria', ''],
    ['Alimentação', ''],
    ['Moradia', ''],
    ['Transporte', ''],
    ['Saúde', ''],
    ['Lazer', ''],
    ['Educação', ''],
    ['Vestuário', ''],
    ['Tecnologia', ''],
    ['Assinaturas', ''],
    ['Outros', ''],
  ],
  [SHEET_NAMES.PROFILE]: [
    ['Informação', 'Valor'],
    ['Data do Diagnóstico', ''],
    ['Renda Fixa Mensal', ''],
    ['Renda Variável Mensal', ''],
    ['Renda Total Mensal', ''],
    ['Capacidade de Poupança', ''],
    ['Score de Saúde Financeira', ''],
    ['Classificação', ''],
    ['', ''],
    ['Objetivo Principal', ''],
    ['Prazo para Quitar Dívidas', ''],
    ['', ''],
    ['Plano de Ação', ''],
  ],
};

export const DEFAULT_BUDGET_CATEGORIES = [
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

/** Retorna a coluna de letra para índice 0-based */
export function colLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/** Retorna range para uma aba, ex: "Transações!A1:F1000" */
export function sheetRange(sheetName: string, from = 'A1', to = 'Z10000'): string {
  return `${sheetName}!${from}:${to}`;
}

/** Range apenas da primeira linha (headers) */
export function headerRange(sheetName: string, cols: number): string {
  return `${sheetName}!A1:${colLetter(cols - 1)}1`;
}
