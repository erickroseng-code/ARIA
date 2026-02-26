import { DriveService } from './DriveService';
import { GmailService } from './GmailService';
import { SheetsService } from './SheetsService';
import { DocsService } from './DocsService';
import { CalendarService } from './CalendarService';
import { isWorkspaceConfigured } from './WorkspaceClient';

/**
 * WorkspaceActionService
 *
 * Interprets natural language intent payloads derived from the AI model
 * and executes the appropriate Google Workspace write/mutation operation.
 *
 * The AI model produces an `action` string and `params` object.
 * This service routes the action to the correct API call.
 */
export type WorkspaceAction =
    // --- Drive ---
    | { service: 'drive'; action: 'renameFile'; params: { fileId: string; newName: string } }
    | { service: 'drive'; action: 'moveFile'; params: { fileId: string; newFolderId: string } }
    | { service: 'drive'; action: 'copyFile'; params: { fileId: string; newName?: string } }
    | { service: 'drive'; action: 'trashFile'; params: { fileId: string } }
    | { service: 'drive'; action: 'restoreFile'; params: { fileId: string } }
    | { service: 'drive'; action: 'deleteFile'; params: { fileId: string } }
    | { service: 'drive'; action: 'createFolder'; params: { name: string; parentId?: string } }
    // --- Gmail ---
    | { service: 'gmail'; action: 'sendEmail'; params: { to: string; subject: string; body: string } }
    | { service: 'gmail'; action: 'replyEmail'; params: { messageId: string; threadId: string; to: string; subject: string; body: string } }
    | { service: 'gmail'; action: 'trashEmail'; params: { messageId: string } }
    | { service: 'gmail'; action: 'deleteEmail'; params: { messageId: string } }
    | { service: 'gmail'; action: 'markAsRead'; params: { messageId: string } }
    | { service: 'gmail'; action: 'markAsUnread'; params: { messageId: string } }
    | { service: 'gmail'; action: 'starEmail'; params: { messageId: string; star: boolean } }
    | { service: 'gmail'; action: 'moveToLabel'; params: { messageId: string; addLabel: string; removeLabel?: string } }
    // --- Sheets ---
    | { service: 'sheets'; action: 'writeRange'; params: { spreadsheetId: string; range: string; values: string[][] } }
    | { service: 'sheets'; action: 'appendRows'; params: { spreadsheetId: string; range: string; values: string[][] } }
    | { service: 'sheets'; action: 'clearRange'; params: { spreadsheetId: string; range: string } }
    | { service: 'sheets'; action: 'addSheet'; params: { spreadsheetId: string; sheetTitle: string } }
    // --- Docs ---
    | { service: 'docs'; action: 'appendText'; params: { documentId: string; text: string } }
    | { service: 'docs'; action: 'replaceText'; params: { documentId: string; findText: string; replaceText: string } }
    | { service: 'docs'; action: 'createDocument'; params: { title: string } }
    // --- Calendar ---
    | { service: 'calendar'; action: 'createEvent'; params: { title: string; startTime: string; endTime: string; description?: string } }
    | { service: 'calendar'; action: 'updateEvent'; params: { eventId: string; title?: string; startTime?: string; endTime?: string; description?: string } }
    | { service: 'calendar'; action: 'deleteEvent'; params: { eventId: string } };

export interface ActionResult {
    success: boolean;
    message: string;
    data?: unknown;
}

export class WorkspaceActionService {

    async execute(action: WorkspaceAction): Promise<ActionResult> {
        if (!(await isWorkspaceConfigured())) {
            return { success: false, message: 'Google Workspace não está configurado. Autorize em http://localhost:3001/api/auth/google/url' };
        }

        try {
            const result = await this.dispatch(action);
            return result;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return { success: false, message: `Erro ao executar ação no Google Workspace: ${msg}` };
        }
    }

    private async dispatch(action: WorkspaceAction): Promise<ActionResult> {
        const drive = new DriveService();
        const gmail = new GmailService();
        const sheets = new SheetsService();
        const docs = new DocsService();

        // ==================== DRIVE ====================
        if (action.service === 'drive') {
            switch (action.action) {
                case 'renameFile': {
                    const file = await drive.renameFile(action.params.fileId, action.params.newName);
                    return { success: true, message: `✅ Arquivo renomeado para "${file.name}" com sucesso.`, data: file };
                }
                case 'moveFile': {
                    const file = await drive.moveFile(action.params.fileId, action.params.newFolderId);
                    return { success: true, message: `✅ Arquivo "${file.name}" movido com sucesso.`, data: file };
                }
                case 'copyFile': {
                    const file = await drive.copyFile(action.params.fileId, action.params.newName);
                    return { success: true, message: `✅ Cópia criada: "${file.name}".`, data: file };
                }
                case 'trashFile': {
                    await drive.trashFile(action.params.fileId);
                    return { success: true, message: `✅ Arquivo enviado para a lixeira.` };
                }
                case 'restoreFile': {
                    await drive.restoreFile(action.params.fileId);
                    return { success: true, message: `✅ Arquivo restaurado da lixeira.` };
                }
                case 'deleteFile': {
                    await drive.deleteFile(action.params.fileId);
                    return { success: true, message: `✅ Arquivo excluído permanentemente.` };
                }
                case 'createFolder': {
                    const folder = await drive.createFolder(action.params.name, action.params.parentId);
                    return { success: true, message: `✅ Pasta "${folder.name}" criada com sucesso.`, data: folder };
                }
                default:
                    return { success: false, message: `Ação Drive desconhecida: ${(action as any).action}` };
            }
        }

        // ==================== GMAIL ====================
        if (action.service === 'gmail') {
            switch (action.action) {
                case 'sendEmail': {
                    const id = await gmail.sendEmail(action.params);
                    return { success: true, message: `✅ E-mail enviado para ${action.params.to}. ID: ${id}`, data: { id } };
                }
                case 'replyEmail': {
                    const id = await gmail.sendEmail({
                        to: action.params.to,
                        subject: action.params.subject,
                        body: action.params.body,
                        replyToMessageId: action.params.messageId,
                        replyToThreadId: action.params.threadId,
                    });
                    return { success: true, message: `✅ Resposta enviada. ID: ${id}` };
                }
                case 'trashEmail': {
                    await gmail.trashEmail(action.params.messageId);
                    return { success: true, message: `✅ E-mail movido para a lixeira.` };
                }
                case 'deleteEmail': {
                    await gmail.deleteEmail(action.params.messageId);
                    return { success: true, message: `✅ E-mail excluído permanentemente.` };
                }
                case 'markAsRead': {
                    await gmail.markAsRead(action.params.messageId);
                    return { success: true, message: `✅ E-mail marcado como lido.` };
                }
                case 'markAsUnread': {
                    await gmail.markAsUnread(action.params.messageId);
                    return { success: true, message: `✅ E-mail marcado como não lido.` };
                }
                case 'starEmail': {
                    await gmail.starEmail(action.params.messageId, action.params.star);
                    return { success: true, message: `✅ E-mail ${action.params.star ? '⭐ estrelado' : 'dessestrelado'}.` };
                }
                case 'moveToLabel': {
                    await gmail.moveToLabel(action.params.messageId, action.params.addLabel, action.params.removeLabel);
                    return { success: true, message: `✅ E-mail movido para a label "${action.params.addLabel}".` };
                }
                default:
                    return { success: false, message: `Ação Gmail desconhecida: ${(action as any).action}` };
            }
        }

        // ==================== SHEETS ====================
        if (action.service === 'sheets') {
            switch (action.action) {
                case 'writeRange': {
                    await sheets.writeRange(action.params.spreadsheetId, action.params.range, action.params.values);
                    return { success: true, message: `✅ Dados escritos em ${action.params.range}.` };
                }
                case 'appendRows': {
                    await sheets.appendRows(action.params.spreadsheetId, action.params.range, action.params.values);
                    return { success: true, message: `✅ ${action.params.values.length} linha(s) adicionada(s) na planilha.` };
                }
                case 'clearRange': {
                    await sheets.clearRange(action.params.spreadsheetId, action.params.range);
                    return { success: true, message: `✅ Intervalo ${action.params.range} limpo.` };
                }
                case 'addSheet': {
                    await sheets.addSheet(action.params.spreadsheetId, action.params.sheetTitle);
                    return { success: true, message: `✅ Aba "${action.params.sheetTitle}" criada na planilha.` };
                }
                default:
                    return { success: false, message: `Ação Sheets desconhecida: ${(action as any).action}` };
            }
        }

        // ==================== DOCS ====================
        if (action.service === 'docs') {
            switch (action.action) {
                case 'appendText': {
                    await docs.appendText(action.params.documentId, action.params.text);
                    return { success: true, message: `✅ Texto adicionado ao final do documento.` };
                }
                case 'replaceText': {
                    await docs.replaceText(action.params.documentId, action.params.findText, action.params.replaceText);
                    return { success: true, message: `✅ Texto "${action.params.findText}" substituído por "${action.params.replaceText}".` };
                }
                case 'createDocument': {
                    const doc = await docs.createDocument(action.params.title);
                    return { success: true, message: `✅ Documento "${doc.title}" criado. ID: ${doc.documentId}`, data: doc };
                }
                default:
                    return { success: false, message: `Ação Docs desconhecida: ${(action as any).action}` };
            }
        }

        // ==================== CALENDAR ====================
        if (action.service === 'calendar') {
            const calendar = new CalendarService();
            switch (action.action) {
                case 'createEvent': {
                    const evt = await calendar.createEvent(action.params.title, action.params.startTime, action.params.endTime, action.params.description);
                    return { success: true, message: `✅ Evento "${evt.title}" criado com sucesso no Calendar. ID: ${evt.id}`, data: evt };
                }
                case 'updateEvent': {
                    const evt = await calendar.updateEvent(action.params.eventId, action.params.title, action.params.startTime, action.params.endTime, action.params.description);
                    return { success: true, message: `✅ Evento atualizado com sucesso no Calendar.`, data: evt };
                }
                case 'deleteEvent': {
                    await calendar.deleteEvent(action.params.eventId);
                    return { success: true, message: `✅ Evento excluído do seu Google Calendar com sucesso.` };
                }
                default:
                    return { success: false, message: `Ação Calendar desconhecida: ${(action as any).action}` };
            }
        }

        return { success: false, message: `Serviço desconhecido: ${(action as any).service}` };
    }
}
