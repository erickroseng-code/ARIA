import { google } from 'googleapis';
import { createWorkspaceClient, withRetry } from './WorkspaceClient';

export interface SheetData {
    spreadsheetId: string;
    title: string;
    range: string;
    values: string[][];
}

/**
 * SheetsService
 * Provides read AND write operations for Google Sheets.
 */
export class SheetsService {

    // ---- READ ---------------------------------------------------------------

    async readRange(spreadsheetId: string, range = 'A1:Z100'): Promise<SheetData> {
        const auth = await createWorkspaceClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const meta = await withRetry(
            () => sheets.spreadsheets.get({ spreadsheetId, fields: 'properties.title' }),
            'SheetsService.readRange.meta',
        );
        const title = meta.data.properties?.title ?? spreadsheetId;
        const res = await withRetry(
            () => sheets.spreadsheets.values.get({ spreadsheetId, range }),
            'SheetsService.readRange.values',
        );
        return { spreadsheetId, title, range, values: (res.data.values ?? []) as string[][] };
    }

    async getSpreadsheetInfo(spreadsheetId: string): Promise<{ id: string; title: string; sheets: string[] }> {
        const auth = await createWorkspaceClient();
        const sheets = google.sheets({ version: 'v4', auth });
        const res = await withRetry(
            () => sheets.spreadsheets.get({ spreadsheetId, fields: 'properties.title,sheets.properties.title' }),
            'SheetsService.getSpreadsheetInfo',
        );
        return {
            id: spreadsheetId,
            title: res.data.properties?.title ?? spreadsheetId,
            sheets: (res.data.sheets ?? []).map((s: any) => s.properties?.title ?? ''),
        };
    }

    // ---- WRITE --------------------------------------------------------------

    /** Write / overwrite values in a range (values is a 2D array of rows x cols) */
    async writeRange(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
        const auth = await createWorkspaceClient();
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });
    }

    /** Append rows to the bottom of a sheet */
    async appendRows(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
        const auth = await createWorkspaceClient();
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values },
        });
    }

    /** Clear (erase) a range */
    async clearRange(spreadsheetId: string, range: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.clear({ spreadsheetId, range, requestBody: {} });
    }

    /** Add a new sheet tab to a spreadsheet */
    async addSheet(spreadsheetId: string, sheetTitle: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{ addSheet: { properties: { title: sheetTitle } } }],
            },
        });
    }

    /** Rename a sheet tab */
    async renameSheet(spreadsheetId: string, sheetId: number, newTitle: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{ updateSheetProperties: { properties: { sheetId, title: newTitle }, fields: 'title' } }],
            },
        });
    }

    // ---- FORMAT -------------------------------------------------------------

    formatForAI(data: SheetData): string {
        if (data.values.length === 0) return `⚠️ Nenhum dado na planilha "${data.title}" (${data.range}).`;
        const rows = data.values.map((row) => `| ${row.join(' | ')} |`).join('\n');
        return `📊 GOOGLE SHEETS — "${data.title}" (${data.range}):\n${rows}`;
    }
}
