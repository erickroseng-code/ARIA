import { llmChat } from './llm-client';
import { getOnboardingState, getSpreadsheetId } from '../finance.service';
import { processOnboardingMessage, getFirstOnboardingMessage } from './onboarding';
import { recordTransaction, queryBalance, queryTransactions } from './expense-controller';
import { setBudget, getBudgetSummary, checkBudgetAlerts } from './budget-planner';
import { generateReportData } from './report-generator';


export type FinanceIntent =
  | 'record_transaction'
  | 'query_balance'
  | 'query_transactions'
  | 'set_budget'
  | 'query_budget'
  | 'generate_report'
  | 'diagnosis_answer'
  | 'debt_query'
  | 'goal_update'
  | 'general_question';

async function detectIntent(message: string): Promise<FinanceIntent> {
  // Heurísticas rápidas antes de chamar LLM
  const lower = message.toLowerCase();

  if (/gastei|paguei|comprei|fui ao|fui n[ao]|almocei|jantei|tomei|uber|ifood|mercado|supermercado|luz|água|aluguel|parcela|boleto/.test(lower)) return 'record_transaction';
  if (/recebi|salário|freela|entrou|depósito/.test(lower)) return 'record_transaction';
  if (/saldo|quanto gastei|quanto tenho|balanço|resumo do mês|quanto sobrou|receitas|despesas do mês/.test(lower)) return 'query_balance';
  if (/transaç|extrato|histórico|lista/.test(lower)) return 'query_transactions';
  if (/orçamento de|budget de|limite para|definir limite|meu orçamento/.test(lower)) return 'set_budget';
  if (/ver orçamento|como está meu orçamento|situação do orçamento/.test(lower)) return 'query_budget';
  if (/relatório|report|gerar relatório|pdf/.test(lower)) return 'generate_report';
  if (/dívida|parcela|empréstimo|cartão|financiamento/.test(lower)) return 'debt_query';

  // Fallback LLM (Groq — rápido e gratuito)
  try {
    const result = await llmChat(
      message,
      `Classifique a intenção em uma destas categorias: record_transaction, query_balance, query_transactions, set_budget, query_budget, generate_report, debt_query, goal_update, general_question. Responda APENAS com a categoria, sem mais nada.`,
      0,
    );
    const intent = result.trim() as FinanceIntent;
    const valid: FinanceIntent[] = ['record_transaction', 'query_balance', 'query_transactions', 'set_budget', 'query_budget', 'generate_report', 'debt_query', 'goal_update', 'general_question'];
    return valid.includes(intent) ? intent : 'general_question';
  } catch {
    return 'general_question';
  }
}

async function handleGeneralQuestion(message: string): Promise<string> {
  const spreadsheetId = getSpreadsheetId();
  const context = spreadsheetId
    ? 'O usuário tem planilha financeira configurada na ARIA.'
    : 'O usuário ainda não configurou a planilha financeira.';

  return llmChat(
    message,
    `Você é o Graham, um assistente financeiro pessoal brasileiro da ARIA. ${context} Responda de forma amigável, prática e em português. Seja conciso (máx 3 parágrafos).`,
    0.7,
  );
}

export interface OrchestratorResponse {
  reply: string;
  alerts: Array<{ category: string; percentage: number; level: string; message: string }>;
  spreadsheetUrl?: string;
  action?: string;
}

/**
 * Ponto de entrada principal — decide qual agente chamar.
 */
export async function processFinanceMessage(userMessage: string): Promise<OrchestratorResponse> {
  // Se o onboarding não está completo, direcionar para ele
  const onboarding = getOnboardingState();
  if (!onboarding.completed) {
    const result = await processOnboardingMessage(userMessage);
    return {
      reply: result.reply,
      alerts: [],
      spreadsheetUrl: result.spreadsheetUrl,
      action: result.completed ? 'onboarding_complete' : 'onboarding_step',
    };
  }

  const intent = await detectIntent(userMessage);
  let reply = '';
  let alerts: OrchestratorResponse['alerts'] = [];
  let action: string | undefined;
  let spreadsheetUrl: string | undefined;

  try {
    switch (intent) {
      case 'record_transaction': {
        const result = await recordTransaction(userMessage);
        reply = result.reply;
        alerts = result.alerts;
        action = 'transaction_recorded';
        break;
      }

      case 'query_balance': {
        reply = await queryBalance();
        action = 'balance_queried';
        break;
      }

      case 'query_transactions': {
        reply = await queryTransactions();
        action = 'transactions_listed';
        break;
      }

      case 'set_budget': {
        // Extrair categoria e valor via heurística simples
        const match = userMessage.match(/(\d+(?:[.,]\d+)?)\s*(?:reais|r\$)?.*?(?:de|para|em)\s+([a-záàâãéèêíïóôõöúüçñ\s]+)/i)
          || userMessage.match(/([a-záàâãéèêíïóôõöúüçñ\s]+).*?(\d+(?:[.,]\d+)?)/i);

        if (match) {
          // Precisamos determinar qual é categoria e qual é valor
          const hasNum1 = !isNaN(parseFloat(match[1]?.replace(',', '.')));
          const amount = hasNum1 ? parseFloat(match[1].replace(',', '.')) : parseFloat(match[2].replace(',', '.'));
          const category = hasNum1 ? match[2].trim() : match[1].trim();
          reply = await setBudget(category, amount);
        } else {
          reply = await getBudgetSummary();
        }
        action = 'budget_set';
        break;
      }

      case 'query_budget': {
        reply = await getBudgetSummary();
        action = 'budget_queried';
        break;
      }

      case 'generate_report': {
        const reportData = await generateReportData();
        const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        reply = `## Relatório — ${reportData.monthLabel}\n\n` +
          `💰 Receitas: ${fmt(reportData.totalIncome)}\n` +
          `💸 Despesas: ${fmt(reportData.totalExpenses)}\n` +
          `📊 Saldo: ${fmt(reportData.netBalance)}\n\n` +
          `${reportData.aiAnalysis}\n\n` +
          `_Use o botão "Baixar PDF" para obter o relatório completo._`;
        action = 'report_generated';
        break;
      }

      case 'debt_query': {
        const spreadsheetId = getSpreadsheetId();
        if (spreadsheetId) {
          const { SheetsService } = await import('@aria/integrations');
          const service = new SheetsService();
          const data = await service.readRange(spreadsheetId, 'Dívidas!A2:F100');
          if (data.values.length === 0) {
            reply = 'Nenhuma dívida registrada na sua planilha. 🎉';
          } else {
            const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const lines = data.values.map(r =>
              `• **${r[0]}**: Total ${fmt(parseFloat(r[1]) || 0)}, Parcela ${fmt(parseFloat(r[5]) || 0)}/mês`
            );
            reply = `### Suas Dívidas\n\n${lines.join('\n')}`;
          }
        } else {
          reply = 'Planilha não configurada.';
        }
        action = 'debt_queried';
        break;
      }

      default: {
        reply = await handleGeneralQuestion(userMessage);
        action = 'general';
      }
    }
  } catch (err) {
    console.error('[Finance Orchestrator] Erro:', err);
    reply = 'Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente.';
  }

  return { reply, alerts, action, spreadsheetUrl };
}

export { getFirstOnboardingMessage };
