import { createGroqClient } from './packages/core/src/ai/GroqAdapter';
import 'dotenv/config';

async function testGroq() {
  console.log('--- TESTANDO GROQ ADAPTER ---');
  const client = createGroqClient(process.env.GROQ_API_KEY);
  
  try {
    const stream = client.messages.stream({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 500,
      system: 'Você é um assistente útil e muito resumido.',
      messages: [{ role: 'user', content: 'Qual é a capital da França? Responda em 1 palavra.' }]
    });

    let count = 0;
    process.stdout.write('Resposta: ');
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        process.stdout.write(chunk.delta.text);
        count++;
      }
    }
    console.log(`\n\n--- FIM (Recebidos ${count} chunks) ---`);
  } catch (err) {
    console.error('Erro:', err);
  }
}

testGroq();
