import { db } from '../../config/db';
import { google } from 'googleapis';
import { createWorkspaceClient } from '@aria/integrations';
import { SheetsService } from '@aria/integrations';
import { SHEET_NAMES, SHEET_HEADERS, DEFAULT_BUDGET_CATEGORIES, headerRange, colLetter } from './sheets-schema';

// Garantir que a tabela de settings existe
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

const SPREADSHEET_ID_KEY = 'finance_spreadsheet_id';
const ONBOARDING_STATE_KEY = 'finance_onboarding_state';

export interface OnboardingState {
  completed: boolean;
  step: number;
  answers: Record<string, string>;
}

export function getSpreadsheetId(): string | null {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SPREADSHEET_ID_KEY) as any;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export function saveSpreadsheetId(id: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(SPREADSHEET_ID_KEY, id);
}

export function getOnboardingState(): OnboardingState {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(ONBOARDING_STATE_KEY) as any;
    if (row?.value) return JSON.parse(row.value) as OnboardingState;
  } catch { /* fall through */ }
  return { completed: false, step: 0, answers: {} };
}

export function saveOnboardingState(state: OnboardingState): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(ONBOARDING_STATE_KEY, JSON.stringify(state));
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

  saveSpreadsheetId(spreadsheetId);
  console.log(`[Finance] ✅ Planilha criada: ${spreadsheetUrl}`);
  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Retorna a URL da planilha do usuário no Google Drive.
 */
export function getSpreadsheetUrl(): string | null {
  const id = getSpreadsheetId();
  if (!id) return null;
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}
