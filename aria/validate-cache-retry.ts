/**
 * Teste de Validação: Cache + Retry
 * - Mede latência de primeira chamada (sem cache)
 * - Mede latência de segunda chamada (com cache)
 * - Calcula melhoria de performance
 */

import { config } from 'dotenv';
config({ path: '.env' });

async function testCache() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   VALIDAÇÃO: CACHE + RETRY            ║');
  console.log('╚════════════════════════════════════════╝\n');

  const sessionId = `test-${Date.now()}`;
  const url = 'http://localhost:3001/api/chat/stream';

  // Test 1: Primeira chamada (sem cache)
  console.log('📊 TESTE 1: Primeira chamada (SEM cache)');
  console.log('─'.repeat(45));

  const start1 = Date.now();
  try {
    const response1 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Tarefas para hoje',
        sessionId: sessionId,
      }),
    });

    let text1 = '';
    const reader1 = response1.body?.getReader();
    while (true) {
      const { done, value } = await reader1!.read();
      if (done) break;
      text1 += new TextDecoder().decode(value);
    }

    const time1 = Date.now() - start1;
    console.log(`✅ Status: ${response1.status}`);
    console.log(`⏱️  Latência: ${time1}ms`);
    console.log(`📝 Resposta: ${text1.substring(0, 100)}...`);
  } catch (error) {
    console.error(`❌ Erro:`, error);
    process.exit(1);
  }

  // Test 2: Segunda chamada rápida (com cache)
  console.log('\n📊 TESTE 2: Segunda chamada (COM cache)');
  console.log('─'.repeat(45));

  const start2 = Date.now();
  try {
    const response2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Tarefas para hoje', // MESMA query
        sessionId: sessionId, // MESMO session
      }),
    });

    let text2 = '';
    const reader2 = response2.body?.getReader();
    while (true) {
      const { done, value } = await reader2!.read();
      if (done) break;
      text2 += new TextDecoder().decode(value);
    }

    const time2 = Date.now() - start2;
    console.log(`✅ Status: ${response2.status}`);
    console.log(`⏱️  Latência: ${time2}ms`);
    console.log(`📝 Resposta: ${text2.substring(0, 100)}...`);

    // Calcular melhoria
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   RESULTADO FINAL                      ║');
    console.log('╚════════════════════════════════════════╝\n');

    const improvement = ((time1 - time2) / time1) * 100;
    const speedup = (time1 / time2).toFixed(1);

    console.log(`1ª Chamada: ${time1}ms`);
    console.log(`2ª Chamada: ${time2}ms`);
    console.log(`\n⚡ Melhoria: ${improvement.toFixed(1)}%`);
    console.log(`🚀 Speedup: ${speedup}x mais rápido`);

    if (time2 < time1 * 0.5) {
      console.log('\n✅ CACHE FUNCIONANDO! (2ª chamada < 50% da 1ª)');
    } else {
      console.log('\n⚠️  Cache não ativado (latências similares)');
    }

    console.log('\n');
  } catch (error) {
    console.error(`❌ Erro:`, error);
    process.exit(1);
  }
}

testCache();
