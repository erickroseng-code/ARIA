import { createGroqClient } from './packages/core/src/ai/GroqAdapter';
import 'dotenv/config';

async function testPrompt() {
    const claude = createGroqClient(process.env.GROQ_API_KEY);

    const userMessage = "exclua o evento Teste Agentic AI de hoje as 15h";
    const extractionPrompt = `Hoje é 2026-02-26 (amanhã: 2026-02-27). 

Histórico recente da conversa (use para encontrar IDs e referências se o usuário não informar diretamente):

Mensagem atual do usuário: "${userMessage}"

Identifique a ação de escrita e retorne APENAS JSON válido, sem outros textos:

Para Calendar criar: {"service":"calendar","action":"createEvent","params":{"title":"título","startTime":"YYYY-MM-DDTHH:MM:00-03:00","endTime":"YYYY-MM-DDTHH:MM:00-03:00","description":""}}
Para Calendar excluir: {"service":"calendar","action":"deleteEvent","params":{"eventId":"ID"}}
Para Calendar atualizar: {"service":"calendar","action":"updateEvent","params":{"eventId":"ID","title":"novo título","startTime":"YYYY-MM-DDTHH:MM:00-03:00","endTime":"YYYY-MM-DDTHH:MM:00-03:00"}}

Se a mensagem pede criar evento no calendário, calcule startTime e endTime em ISO 8601 com fuso -03:00.
Retorne apenas o JSON da ação identificada, sem mais texto.`;

    console.log('Sending to LLM...');
    const extractionMsg = await claude.messages.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 300,
        system: 'Você é um extrator JSON altamente preciso. Responda SEMPRE com apenas JSON válido, sem explicações.',
        messages: [{ role: 'user', content: extractionPrompt }],
    });

    console.log('LLM Result:');
    console.log(extractionMsg.content[0].text);
}

testPrompt();
