import { google } from 'googleapis';
import { createWorkspaceClient } from '@aria/integrations';
import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function checkEvents() {
    try {
        console.log('Autenticando...');
        const auth = await createWorkspaceClient();
        const calendar = google.calendar({ version: 'v3', auth });

        console.log('Buscando eventos em primary...');
        const res = await calendar.events.list({
            calendarId: 'primary',
            q: 'Casa aos Ovos', // Buscar pelo nome exato que a IA tentou agendar
            showDeleted: false,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = res.data.items;
        if (!events || events.length === 0) {
            console.log('Nenhum evento com "Casa aos Ovos" encontrado na primary.');
        } else {
            console.log('Eventos encontrados na primary:');
            events.forEach((event, i) => {
                const start = event.start?.dateTime || event.start?.date;
                console.log(`[${i}] Resumo: ${event.summary} | Início: ${start} | Criador: ${event.creator?.email}`);
            });
        }

        console.log('\n--- Buscando todos os eventos dos próximos 10 dias na primary ---');
        const now = new Date();
        const next10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
        const resRecent = await calendar.events.list({
            calendarId: 'primary',
            timeMin: now.toISOString(),
            timeMax: next10Days.toISOString(),
            showDeleted: false,
            singleEvents: true,
            orderBy: 'startTime',
        });


    } catch (err) {
        console.error('Erro ao buscar eventos:', err);
    }
}

checkEvents();
