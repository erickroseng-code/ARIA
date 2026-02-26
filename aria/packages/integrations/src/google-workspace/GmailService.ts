import { google } from 'googleapis';
import { createWorkspaceClient, withRetry } from './WorkspaceClient';

export interface GmailMessage {
    id: string;
    threadId?: string;
    snippet: string;
    subject: string;
    from: string;
    to?: string;
    date: string;
    unread: boolean;
}

export interface SendEmailOptions {
    to: string;
    subject: string;
    body: string;
    replyToMessageId?: string;
    replyToThreadId?: string;
}

/**
 * GmailService
 * Provides read AND write operations for Gmail.
 */
export class GmailService {

    // ---- READ ---------------------------------------------------------------

    async listRecentEmails(limit = 10, onlyUnread = false): Promise<GmailMessage[]> {
        const auth = await createWorkspaceClient();
        const gmail = google.gmail({ version: 'v1', auth });
        const q = onlyUnread ? 'is:unread' : '';
        const listRes = await withRetry(
            () => gmail.users.messages.list({ userId: 'me', maxResults: limit, q }),
            'GmailService.listRecentEmails',
        );
        const messages = listRes.data.messages ?? [];
        return Promise.all(messages.map((m) => this.fetchMessage(gmail, m.id!)));
    }

    async searchEmails(query: string, limit = 10): Promise<GmailMessage[]> {
        const auth = await createWorkspaceClient();
        const gmail = google.gmail({ version: 'v1', auth });
        const listRes = await withRetry(
            () => gmail.users.messages.list({ userId: 'me', maxResults: limit, q: query }),
            'GmailService.searchEmails',
        );
        const messages = listRes.data.messages ?? [];
        return Promise.all(messages.map((m) => this.fetchMessage(gmail, m.id!)));
    }

    async getMessageById(messageId: string): Promise<GmailMessage> {
        const auth = await createWorkspaceClient();
        const gmail = google.gmail({ version: 'v1', auth });
        return this.fetchMessage(gmail, messageId);
    }

    private async fetchMessage(gmail: any, id: string): Promise<GmailMessage> {
        const res: any = await withRetry<any>(
            () => gmail.users.messages.get({
                userId: 'me', id, format: 'metadata',
                metadataHeaders: ['Subject', 'From', 'To', 'Date'],
            }),
            'GmailService.fetchMessage',
        );
        const headers: { name: string; value: string }[] = res.data.payload?.headers ?? [];
        const get = (name: string) => headers.find((h) => h.name === name)?.value ?? '';
        
        const rawDate = get('Date');
        let formattedDate = rawDate;
        try {
            if (rawDate) {
                const dateObj = new Date(rawDate);
                if (!isNaN(dateObj.getTime())) {
                    formattedDate = new Intl.DateTimeFormat('pt-BR', {
                        timeZone: 'America/Sao_Paulo',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    }).format(dateObj) + ' (Horário de Brasília)';
                }
            }
        } catch (e) {
            // Se falhar o parse, mantém a original
        }

        return {
            id,
            threadId: res.data.threadId,
            snippet: res.data.snippet ?? '',
            subject: get('Subject'),
            from: get('From'),
            to: get('To'),
            date: formattedDate,
            unread: (res.data.labelIds ?? []).includes('UNREAD'),
        };
    }

    // ---- WRITE --------------------------------------------------------------

    /** Send an email (or reply to an existing thread) */
    async sendEmail(opts: SendEmailOptions): Promise<string> {
        const auth = await createWorkspaceClient();
        const gmail = google.gmail({ version: 'v1', auth });

        const headers = [
            `To: ${opts.to}`,
            `Subject: ${opts.replyToMessageId ? `Re: ${opts.subject}` : opts.subject}`,
            'Content-Type: text/plain; charset=utf-8',
            'MIME-Version: 1.0',
        ];

        if (opts.replyToMessageId) {
            headers.push(`In-Reply-To: ${opts.replyToMessageId}`);
            headers.push(`References: ${opts.replyToMessageId}`);
        }

        const raw = Buffer.from(`${headers.join('\r\n')}\r\n\r\n${opts.body}`)
            .toString('base64')
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const res = await withRetry(
            () => gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw,
                    ...(opts.replyToThreadId ? { threadId: opts.replyToThreadId } : {}),
                },
            }),
            'GmailService.sendEmail',
        );
        return res.data.id!;
    }

    /** Move email to trash */
    async trashEmail(messageId: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const gmail = google.gmail({ version: 'v1', auth });
        await gmail.users.messages.trash({ userId: 'me', id: messageId });
    }

    /** Restore email from trash */
    async untrashEmail(messageId: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const gmail = google.gmail({ version: 'v1', auth });
        await gmail.users.messages.untrash({ userId: 'me', id: messageId });
    }

    /** Permanently delete an email (cannot be undone) */
    async deleteEmail(messageId: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const gmail = google.gmail({ version: 'v1', auth });
        await gmail.users.messages.delete({ userId: 'me', id: messageId });
    }

    /** Mark as read */
    async markAsRead(messageId: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const gmail = google.gmail({ version: 'v1', auth });
        await gmail.users.messages.modify({
            userId: 'me', id: messageId,
            requestBody: { removeLabelIds: ['UNREAD'] },
        });
    }

    /** Mark as unread */
    async markAsUnread(messageId: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const gmail = google.gmail({ version: 'v1', auth });
        await gmail.users.messages.modify({
            userId: 'me', id: messageId,
            requestBody: { addLabelIds: ['UNREAD'] },
        });
    }

    /** Star/unstar an email */
    async starEmail(messageId: string, star: boolean): Promise<void> {
        const auth = await createWorkspaceClient();
        const gmail = google.gmail({ version: 'v1', auth });
        await gmail.users.messages.modify({
            userId: 'me', id: messageId,
            requestBody: {
                addLabelIds: star ? ['STARRED'] : [],
                removeLabelIds: star ? [] : ['STARRED'],
            },
        });
    }

    /** Move email to a specific label/folder (e.g. INBOX, SPAM, label ID) */
    async moveToLabel(messageId: string, addLabel: string, removeLabel?: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const gmail = google.gmail({ version: 'v1', auth });
        await gmail.users.messages.modify({
            userId: 'me', id: messageId,
            requestBody: {
                addLabelIds: [addLabel],
                removeLabelIds: removeLabel ? [removeLabel] : [],
            },
        });
    }

    /** List all user-defined labels */
    async listLabels(): Promise<{ id: string; name: string }[]> {
        const auth = await createWorkspaceClient();
        const gmail = google.gmail({ version: 'v1', auth });
        const res = await gmail.users.labels.list({ userId: 'me' });
        return (res.data.labels ?? []).map((l) => ({ id: l.id!, name: l.name! }));
    }

    // ---- FORMAT -------------------------------------------------------------

    formatForAI(emails: GmailMessage[], context: string): string {
        if (emails.length === 0) return `⚠️ Nenhum email encontrado no Gmail (${context}).`;
        const lines = emails.map(
            (e) => `• ${e.unread ? '📩 [NÃO LIDO] ' : ''}**${e.subject}** — ID: ${e.id}\n  De: ${e.from} | ${e.date}\n  Prévia: ${e.snippet}`
        );
        return `📧 GMAIL — ${context}:\n${lines.join('\n\n')}`;
    }
}
