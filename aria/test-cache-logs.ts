/**
 * Teste de Cache - Verificar logs
 * Faz 2 chamadas e verifica se o cache está sendo usado
 */

import { config } from 'dotenv';
config({ path: '.env' });

async function testCacheLogs() {
  console.log('\n🔍 TESTE DE CACHE - Verificando logs do ClickUp\n');

  const sessionId = `cache-test-${Date.now()}`;
  const url = 'http://localhost:3001/api/chat/stream';

  // Test 1
  console.log('📝 CHAMADA 1: "Tarefas para hoje"');
  console.log('─'.repeat(50));
  
  const payload = {
    content: 'Tarefas para hoje',
    sessionId: sessionId,
  };

  const response1 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // Consume stream
  let chunk1 = '';
  const reader1 = response1.body?.getReader();
  while (true) {
    const { done, value } = await reader1!.read();
    if (done) break;
    chunk1 += new TextDecoder().decode(value);
  }

  console.log('✅ Resposta recebida (primeiras 150 chars):');
  console.log(chunk1.substring(0, 150));
  
  // Esperar 2 segundos
  console.log('\n⏳ Aguardando 2 segundos...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2 - MESMA query
  console.log('📝 CHAMADA 2: "Tarefas para hoje" (MESMA query)');
  console.log('─'.repeat(50));

  const response2 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let chunk2 = '';
  const reader2 = response2.body?.getReader();
  while (true) {
    const { done, value } = await reader2!.read();
    if (done) break;
    chunk2 += new TextDecoder().decode(value);
  }

  console.log('✅ Resposta recebida (primeiras 150 chars):');
  console.log(chunk2.substring(0, 150));

  console.log('\n✅ Teste concluído!');
  console.log('\n📌 Abra os logs do servidor para verificar:');
  console.log('   - "[ClickUpQueryService.getMyTasks] Retornando do cache"');
  console.log('   - ou "[ClickUpQueryService.getMyTasks] Cache updated"');
  console.log('\n');
}

testCacheLogs().catch(console.error);
