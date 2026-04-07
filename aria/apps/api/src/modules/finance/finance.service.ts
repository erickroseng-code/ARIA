import { google } from 'googleapis';
import { createWorkspaceClient } from '@aria/integrations';
import { SheetsService } from '@aria/integrations';
import { SHEET_NAMES, SHEET_HEADERS, DEFAULT_BUDGET_CATEGORIES, headerRange, colLetter } from './sheets-schema';
import { getSetting, setSetting } from '../../config/supabase';

const SPREADSHEET_ID_KEY = 'finance_spreadsheet_id';
const ONBOARDING_STATE_KEY = 'finance_onboarding_state';

function getSpreadsheetIdFromEnv(): string | null {
  const candidates = [
    process.env.FINANCE_SPREADSHEET_ID,
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    process.env.SPREADSHEET_ID,
  ];
  for (const raw of candidates) {
    const id = raw?.trim();
    if (id) return id;
  }
  return null;
}

export interface OnboardingState {
  completed: boolean;
  step: number;
  answers: Record<string, string>;
}

export async function getSpreadsheetId(): Promise<string | null> {
  try {
    const dbId = await getSetting(SPREADSHEET_ID_KEY);
    return dbId?.trim() ?? getSpreadsheetIdFromEnv();
  } catch {
    return getSpreadsheetIdFromEnv();
  }
}

export async function saveSpreadsheetId(id: string): Promise<void> {
  await setSetting(SPREADSHEET_ID_KEY, id);
}

export async function getOnboardingState(): Promise<OnboardingState> {
  try {
    const value = await getSetting(ONBOARDING_STATE_KEY);
    if (value) return JSON.parse(value) as OnboardingState;
  } catch { /* fall through */ }
  return { completed: false, step: 0, answers: {} };
}

export async function saveOnboardingState(state: OnboardingState): Promise<void> {
  await setSetting(ONBOARDING_STATE_KEY, JSON.stringify(state));
}

/**
 * Cria uma nova planilha "ARIA — Controle Financeiro" no Google Drive do usuário,
 * adiciona todas as abas com cabeçalhos e retorna o ID da planilha.
 */
export async function setupSpreadsheet(): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const auth = await createWorkspaceClient();
  const sheets = google.sheets({ version: 'v4', auth });

  // Criar a planilha com as abas necessárias de uma vez
  const sheetNames = Object.values(SHEET_NAMES);
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'ARIA — Controle Financeiro' },
      sheets: sheetNames.map((name) => ({
        properties: { title: name },
      })),
    },
  });

  const spreadsheetId = createRes.data.spreadsheetId!;
  const spreadsheetUrl = createRes.data.spreadsheetUrl!;

  // Escrever os cabeçalhos em cada aba
  const service = new SheetsService();
  for (const [sheetName, headers] of Object.entries(SHEET_HEADERS)) {
    const cols = headers[0].length;
    const range = headerRange(sheetName, cols);
    await service.writeRange(spreadsheetId, range, headers as string[][]);
  }

  // Pré-popular aba Orçamento com categorias padrão (sem valores ainda)
  const budgetRows = DEFAULT_BUDGET_CATEGORIES.map((cat) => [cat, '', '', '', '']);
  await service.appendRows(spreadsheetId, `${SHEET_NAMES.BUDGET}!A2`, budgetRows);

  await saveSpreadsheetId(spreadsheetId);
  console.log(`[Finance] ✅ Planilha criada: ${spreadsheetUrl}`);
  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Retorna a URL da planilha do usuário no Google Drive.
 */
export async function getSpreadsheetUrl(): Promise<string | null> {
  const id = await getSpreadsheetId();
  if (!id) return null;
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}
