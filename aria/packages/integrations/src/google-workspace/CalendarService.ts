import { google } from 'googleapis';
import { createWorkspaceClient, withRetry } from './WorkspaceClient';

export interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    location?: string;
    startTime: string;
    endTime: string;
    htmlLink: string;
    attendees?: { email: string; responseStatus: string }[];
}

export class CalendarService {

    // ---- READ ----

    /**
     * Lists upcoming events between a start and end date.
     * Default looks at the next 7 days if not provided.
     */
    async listEvents(startDate?: Date, endDate?: Date, maxResults: number = 20): Promise<CalendarEvent[]> {
        const auth = await createWorkspaceClient();
        const calendar = google.calendar({ version: 'v3', auth });

        const timeMin = startDate ? startDate.toISOString() : new Date().toISOString();

        let timeMax;
        if (endDate) {
            timeMax = endDate.toISOString();
        } else {
            // Extended to 30 days to increase the chance of finding upcoming events
            const nextMonth = new Date();
            nextMonth.setDate(nextMonth.getDate() + 30);
            timeMax = nextMonth.toISOString();
        }

        console.log('[CalendarService.listEvents] Fetching events:', { timeMin, timeMax, maxResults });

        const res = await withRetry(
            () => calendar.events.list({
                calendarId: 'primary',
                timeMin,
                timeMax,
                maxResults,
                singleEvents: true,
                orderBy: 'startTime',
            }),
            'CalendarService.listEvents',
        );

        const events = res.data.items ?? [];
        console.log('[CalendarService.listEvents] Events returned:', events.length);
        return events.map(this.mapEventData);
    }

    // ---- FORMAT FOR AI ----

    formatForAI(events: CalendarEvent[], context: string): string {
        if (events.length === 0) return `⚠️ Nenhum evento na agenda encontrado (${context}).`;
        const lines = events.map(e =>
            `• **${e.title}** (Reunião)\n  ID: ${e.id}\n  Início: ${this.formatDateTime(e.startTime)}\n  Término: ${this.formatDateTime(e.endTime)}${e.description ? `\n  Detalhes: ${e.description}` : ''}`
        );
        return `📅 GOOGLE CALENDAR — ${context}:\n${lines.join('\n\n')}`;
    }

    private formatDateTime(isoString: string): string {
        try {
            const date = new Date(isoString);
            if (isNaN(date.getTime())) return isoString;
            return new Intl.DateTimeFormat('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date) + ' (Horário de Brasília)';
        } catch {
            return isoString;
        }
    }

    // ---- WRITE ----

    async createEvent(title: string, startTime: string, endTime: string, description?: string): Promise<CalendarEvent> {
        const auth = await createWorkspaceClient();
        const calendar = google.calendar({ version: 'v3', auth });

        const res = await withRetry(
            () => calendar.events.insert({
                calendarId: 'primary',
                requestBody: {
                    summary: title,
                    description,
                    start: { dateTime: startTime, timeZone: 'America/Sao_Paulo' },
                    end: { dateTime: endTime, timeZone: 'America/Sao_Paulo' },
                },
            }),
            'CalendarService.createEvent',
        );

        return this.mapEventData(res.data);
    }

    async updateEvent(eventId: string, title?: string, startTime?: string, endTime?: string, description?: string): Promise<CalendarEvent> {
        const auth = await createWorkspaceClient();
        const calendar = google.calendar({ version: 'v3', auth });

        const requestBody: any = {};
        if (title !== undefined) requestBody.summary = title;
        if (description !== undefined) requestBody.description = description;
        if (startTime !== undefined) requestBody.start = { dateTime: startTime, timeZone: 'America/Sao_Paulo' };
        if (endTime !== undefined) requestBody.end = { dateTime: endTime, timeZone: 'America/Sao_Paulo' };

        const res = await withRetry(
            () => calendar.events.patch({ calendarId: 'primary', eventId, requestBody }),
            'CalendarService.updateEvent',
        );

        return this.mapEventData(res.data);
    }

    async deleteEvent(eventId: string): Promise<void> {
        const auth = await createWorkspaceClient();
        const calendar = google.calendar({ version: 'v3', auth });

        await withRetry(
            () => calendar.events.delete({ calendarId: 'primary', eventId }),
            'CalendarService.deleteEvent',
        );
    }

    private mapEventData(item: any): CalendarEvent {
        return {
            id: item.id!,
            title: item.summary ?? 'Sem título',
            description: item.description,
            location: item.location,
            startTime: item.start?.dateTime || item.start?.date || '',
            endTime: item.end?.dateTime || item.end?.date || '',
            htmlLink: item.htmlLink ?? '',
            attendees: item.attendees?.map((a: any) => ({
                email: a.email,
                responseStatus: a.responseStatus
            }))
        };
    }
}
