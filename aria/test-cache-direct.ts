/**
 * Teste de Cache Direto
 * Testa o cache do ClickUpQueryService sem passar pela IA
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { initializeClickUpClient, initializeClickUpQueryService } from './packages/integrations/src/clickup/index';

async function testCacheDirect() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   TESTE DIRETO: CACHE DO CLICKUP      ║');
  console.log('╚════════════════════════════════════════╝\n');

  const token = process.env.CLICKUP_API_TOKEN;
  const listId = process.env.CLICKUP_DEFAULT_LIST_ID || process.env.CLICKUP_ID_LIST;
  const teamId = process.env.CLICKUP_TEAM_ID;
  const userId = process.env.CLICKUP_USER_ID ? parseInt(process.env.CLICKUP_USER_ID) : 164632817;

  if (!token || !listId) {
    console.error('❌ Credenciais faltando');
    process.exit(1);
  }

  const client = initializeClickUpClient(token, listId);
  const queryService = initializeClickUpQueryService(client, teamId || '', listId, userId);

  // TESTE 1: Primeira chamada (sem cache)
  console.log('📊 TESTE 1: Primeira chamada (SEM cache)');
  console.log('─'.repeat(50));

  const t1Start = Date.now();
  const tasks1 = await queryService.getMyTasks('today');
  const t1End = Date.now();

  console.log(`✅ Tarefas encontradas: ${tasks1.length}`);
  console.log(`⏱️  Latência: ${t1End - t1Start}ms`);
  console.log(`📝 Primeira tarefa: ${tasks1[0]?.name || 'N/A'}`);

  // TESTE 2: Segunda chamada (com cache - mesmos 2 segundos)
  console.log('\n⏳ Aguardando 1 segundo...\n');
  await new Promise(r => setTimeout(r, 1000));

  console.log('📊 TESTE 2: Segunda chamada (COM cache)');
  console.log('─'.repeat(50));

  const t2Start = Date.now();
  const tasks2 = await queryService.getMyTasks('today');
  const t2End = Date.now();

  console.log(`✅ Tarefas encontradas: ${tasks2.length}`);
  console.log(`⏱️  Latência: ${t2End - t2Start}ms`);
  console.log(`📝 Primeira tarefa: ${tasks2[0]?.name || 'N/A'}`);

  // RESULTADO
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   RESULTADO DO CACHE                   ║');
  console.log('╚════════════════════════════════════════╝\n');

  const latency1 = t1End - t1Start;
  const latency2 = t2End - t2Start;
  const improvement = ((latency1 - latency2) / latency1) * 100;
  const speedup = (latency1 / latency2).toFixed(1);

  console.log(`1ª Chamada (sem cache): ${latency1}ms`);
  console.log(`2ª Chamada (com cache): ${latency2}ms`);
  console.log(`\n⚡ Melhoria: ${improvement.toFixed(1)}%`);
  console.log(`🚀 Speedup: ${speedup}x mais rápido`);

  if (latency2 < latency1 * 0.5) {
    console.log('\n✅ CACHE FUNCIONANDO PERFEITAMENTE!');
    console.log('   (2ª chamada é menos de 50% da 1ª)');
  } else if (latency2 < latency1 * 0.8) {
    console.log('\n✅ CACHE FUNCIONANDO BEM');
    console.log('   (2ª chamada é 80% mais rápida)');
  } else {
    console.log('\n⚠️  CACHE NÃO ATIVADO');
    console.log('   (latências similares)');
  }

  console.log('\n');
}

testCacheDirect().catch(console.error);
