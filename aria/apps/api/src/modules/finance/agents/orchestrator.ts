import { llmChat } from './llm-client';
import { getSpreadsheetId } from '../finance.service';
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
  // LLM-first: classifica com full context (Groq é ultra-rápido e gratuito)
  try {
    const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const result = await llmChat(
      `Mensagem do usuário: "${message}"`,
      `Hoje é ${today}. Classifique a intenção financeira em UMA destas categorias e responda SOMENTE com ela, sem explicações:

record_transaction — registrar gasto, receita, compra, pagamento, transferência (ex: "gastei 50 no uber", "recebi salário", "paguei boleto")
query_balance — ver saldo, resumo do mês, receitas vs despesas (ex: "como estão meus gastos?", "quanto gastei esse mês?")
query_transactions — listar transações, extrato, histórico (ex: "me mostra minhas transações", "extrato de fevereiro", "gastos em alimentação")
set_budget — definir ou alterar limite/orçamento de categoria (ex: "coloca 500 de orçamento em alimentação", "limite de 200 para lazer")
query_budget — ver situação do orçamento atual (ex: "como está meu orçamento?", "ver limites")
generate_report — gerar relatório ou PDF (ex: "gera relatório do mês", "quero o PDF")
debt_query — consultar dívidas, parcelas, financiamentos (ex: "minhas dívidas", "quanto devo no cartão")
goal_update — atualizar metas financeiras
general_question — qualquer outra pergunta ou conversa geral

Categorias: record_transaction, query_balance, query_transactions, set_budget, query_budget, generate_report, debt_query, goal_update, general_question`,
      0,
    );
    const intent = result.trim().split(/\s/)[0] as FinanceIntent;
    const valid: FinanceIntent[] = ['record_transaction', 'query_balance', 'query_transactions', 'set_budget', 'query_budget', 'generate_report', 'debt_query', 'goal_update', 'general_question'];
    return valid.includes(intent) ? intent : 'general_question';
  } catch {
    return 'general_question';
  }
}

/** Extrai categoria e valor de uma mensagem de orçamento via LLM */
async function extractBudgetParams(message: string): Promise<{ category: string | null; amount: number | null }> {
  try {
    const raw = await llmChat(
      `Mensagem: "${message}"`,
      `Extraia a categoria de orçamento e o valor desta mensagem. Responda SOMENTE com JSON válido:
{"category": "nome da categoria", "amount": 123.45}

Categorias válidas: Alimentação, Moradia, Transporte, Saúde, Lazer, Educação, Vestuário, Tecnologia, Assinaturas, Outros
Se não encontrar algum campo, use null. Valores monetários devem ser números (não strings).`,
      0,
    );
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : raw);
    return {
      category: parsed.category ?? null,
      amount: parsed.amount != null ? parseFloat(String(parsed.amount).replace(',', '.')) : null,
    };
  } catch {
    return { category: null, amount: null };
  }
}

/** Extrai mês de referência e categoria opcional de uma mensagem via LLM */
async function extractQueryParams(message: string): Promise<{ month: string | null; category: string | null }> {
  const today = new Date().toISOString().substring(0, 7);
  try {
    const raw = await llmChat(
      `Mensagem: "${message}"`,
      `Hoje é ${today}. Extraia o mês de referência e a categoria desta mensagem. Responda SOMENTE com JSON válido:
{"month": "YYYY-MM" ou null, "category": "nome da categoria" ou null}

- Se o usuário não mencionar mês específico, use null (não o mês atual).
- Categorias válidas: Alimentação, Moradia, Transporte, Saúde, Lazer, Educação, Vestuário, Tecnologia, Assinaturas, Outros.
- Se o usuário não mencionar categoria, use null.`,
      0,
    );
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw);
  } catch {
    return { month: null, category: null };
  }
}

async function handleGeneralQuestion(message: string): Promise<string> {
  const useSheets = process.env.FINANCE_USE_SHEETS === 'true';
  const spreadsheetId = useSheets ? await getSpreadsheetId() : null;
  const context = spreadsheetId
    ? 'O usuário tem planilha financeira configurada na ARIA (Google Sheets).'
    : 'O usuário usa o banco de dados (Supabase) para finanças.';

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
        const { month: balanceMonth } = await extractQueryParams(userMessage);
        reply = await queryBalance(balanceMonth ?? undefined);
        action = 'balance_queried';
        break;
      }

      case 'query_transactions': {
        const { month: txMonth, category: txCategory } = await extractQueryParams(userMessage);
        reply = await queryTransactions(txMonth ?? undefined, txCategory ?? undefined);
        action = 'transactions_listed';
        break;
      }

      case 'set_budget': {
        const { category, amount } = await extractBudgetParams(userMessage);
        if (category && amount != null && !isNaN(amount)) {
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
        const spreadsheetId = await getSpreadsheetId();
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

