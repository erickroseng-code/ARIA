import { ChatService } from './packages/core/src/chat/ChatService';
import { createGroqClient } from './packages/core/src/ai/GroqAdapter';
import 'dotenv/config';

async function testExcluir() {
    console.log('--- TESTANDO INTENÇÃO DE EXCLUIR EVENTO ---');
    const client = createGroqClient(process.env.GROQ_API_KEY);
    const service = new ChatService(client, {} as any, null as any);

    try {
        const stream = service.streamResponse('exclua o evento de Teste Agentic AI amanhã as 15h', 'test-session');

        for await (const chunk of stream) {
            process.stdout.write(chunk);
        }
        console.log('\n--- FIM ---');
    } catch (err) {
        console.error('Erro:', err);
    }
}

testExcluir();
