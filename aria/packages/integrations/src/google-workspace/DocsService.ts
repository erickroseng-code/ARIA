import { google } from 'googleapis';
import { createWorkspaceClient, withRetry } from './WorkspaceClient';

export interface DocContent {
    documentId: string;
    title: string;
    text: string;
}

/**
 * DocsService
 * Provides read AND write operations for Google Docs.
 */
export class DocsService {

    // ---- READ ---------------------------------------------------------------

    async readDocument(documentId: string): Promise<DocContent> {
        const auth = await createWorkspaceClient();
        const docs = google.docs({ version: 'v1', auth });
        const res = await withRetry(
            () => docs.documents.get({ documentId }),
            'DocsService.readDocument',
        );
        const title = res.data.title ?? documentId;
        const content = res.data.body?.content ?? [];
        const text = content
            .flatMap((c) => c.paragraph?.elements ?? [])
            .map((el) => el.textRun?.content ?? '')
            .join('')
            .trim();
        return { documentId, title, text };
    }

    // ---- WRITE --------------------------------------------------------------

    /** Append text at the end of the document */
    async appendText(documentId: string, text: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const docs = google.docs({ version: 'v1', auth });

        // Read current end index
        const docRes = await withRetry(
            () => docs.documents.get({ documentId }),
            'DocsService.appendText.get',
        );
        const body = docRes.data.body;
        const endIndex = (body?.content?.at(-1)?.endIndex ?? 1) - 1;

        await docs.documents.batchUpdate({
            documentId,
            requestBody: {
                requests: [{
                    insertText: {
                        location: { index: endIndex },
                        text: `\n${text}`,
                    },
                }],
            },
        });
    }

    /** Replace occurrences of a string in the document */
    async replaceText(documentId: string, findText: string, replaceText: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const docs = google.docs({ version: 'v1', auth });
        await docs.documents.batchUpdate({
            documentId,
            requestBody: {
                requests: [{
                    replaceAllText: {
                        containsText: { text: findText, matchCase: true },
                        replaceText,
                    },
                }],
            },
        });
    }

    /** Insert text at a specific index position */
    async insertTextAt(documentId: string, index: number, text: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const docs = google.docs({ version: 'v1', auth });
        await docs.documents.batchUpdate({
            documentId,
            requestBody: {
                requests: [{ insertText: { location: { index }, text } }],
            },
        });
    }

    /** Delete text in a range (startIndex to endIndex) */
    async deleteRange(documentId: string, startIndex: number, endIndex: number): Promise<void> {
        const auth = await createWorkspaceClient();
        const docs = google.docs({ version: 'v1', auth });
        await docs.documents.batchUpdate({
            documentId,
            requestBody: {
                requests: [{ deleteContentRange: { range: { startIndex, endIndex } } }],
            },
        });
    }

    /** Create a new blank Google Doc */
    async createDocument(title: string): Promise<DocContent> {
        const auth = await createWorkspaceClient();
        const docs = google.docs({ version: 'v1', auth });
        const res = await docs.documents.create({ requestBody: { title } });
        return { documentId: res.data.documentId!, title, text: '' };
    }

    // ---- FORMAT -------------------------------------------------------------

    formatForAI(doc: DocContent, maxChars = 2000): string {
        if (!doc.text) return `⚠️ Documento "${doc.title}" está vazio ou sem texto.`;
        const truncated = doc.text.length > maxChars
            ? doc.text.slice(0, maxChars) + `\n... [Truncado — ${doc.text.length} chars total]`
            : doc.text;
        return `📄 GOOGLE DOCS — "${doc.title}" (ID: ${doc.documentId}):\n${truncated}`;
    }
}
