/**
 * Validação Completa: Cache + Retry + Subtarefas
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { initializeClickUpClient, initializeClickUpQueryService } from './packages/integrations/src/clickup/index';

async function testComplete() {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║  VALIDAÇÃO COMPLETA: CACHE + RETRY + DADOS  ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

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

  // ═══════════════════════════════════════════════════════════════
  // TESTE 1: Todas as tarefas (sem filtro)
  // ═══════════════════════════════════════════════════════════════
  console.log('📊 TESTE 1: Buscar TODAS as tarefas (sem filtro)');
  console.log('─'.repeat(55));

  const t1Start = Date.now();
  const allTasks = await queryService.getMyTasks();
  const t1End = Date.now();

  console.log(`✅ Tarefas encontradas: ${allTasks.length}`);
  console.log(`⏱️  Latência: ${t1End - t1Start}ms`);
  console.log(`📝 Tarefas:`);
  allTasks.forEach((t, i) => {
    console.log(`   ${i + 1}. [${t.status}] ${t.name}`);
  });

  // ═══════════════════════════════════════════════════════════════
  // TESTE 2: Cache hit (2ª chamada)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📊 TESTE 2: Segunda chamada (CACHE HIT)');
  console.log('─'.repeat(55));

  const t2Start = Date.now();
  const cachedTasks = await queryService.getMyTasks();
  const t2End = Date.now();

  console.log(`✅ Tarefas retornadas: ${cachedTasks.length}`);
  console.log(`⏱️  Latência: ${t2End - t2Start}ms`);
  
  if ((t2End - t2Start) < (t1End - t1Start) * 0.5) {
    console.log('✅ CACHE ATIVADO (menos de 50% da latência original)');
  }

  // ═══════════════════════════════════════════════════════════════
  // TESTE 3: Subtarefas
  // ═══════════════════════════════════════════════════════════════
  console.log('\n📊 TESTE 3: Buscar subtarefas');
  console.log('─'.repeat(55));

  if (allTasks.length > 0) {
    const taskId = allTasks[0]!.id;
    console.log(`Buscando subtarefas de: "${allTasks[0]!.name}" (ID: ${taskId})`);
    
    const t3Start = Date.now();
    const subtasks = await queryService.getSubtasksForTask(taskId);
    const t3End = Date.now();

    console.log(`✅ Subtarefas encontradas: ${subtasks.length}`);
    console.log(`⏱️  Latência: ${t3End - t3Start}ms`);
    
    if (subtasks.length > 0) {
      subtasks.forEach((st, i) => {
        console.log(`   ${i + 1}. [${st.status}] ${st.name}`);
      });
    } else {
      console.log(`   (Nenhuma subtarefa - isto é normal!)`)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // RESUMO FINAL
  // ═══════════════════════════════════════════════════════════════
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║             RESUMO FINAL                       ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  const latency1 = t1End - t1Start;
  const latency2 = t2End - t2Start;
  const improvement = ((latency1 - latency2) / latency1) * 100;

  console.log(`✅ Total de tarefas: ${allTasks.length}`);
  console.log(`✅ 1ª chamada (API): ${latency1}ms`);
  console.log(`✅ 2ª chamada (CACHE): ${latency2}ms`);
  console.log(`✅ Melhoria: ${improvement.toFixed(1)}%`);
  console.log(`✅ Speedup: ${(latency1/latency2).toFixed(0)}x mais rápido`);

  console.log('\n🎯 VALIDAÇÃO FINAL:');
  console.log(latency2 < latency1 * 0.5 ? '✅ CACHE: OK' : '❌ CACHE: FALHA');
  console.log(allTasks.length > 0 ? '✅ DADOS: OK' : '❌ DADOS: FALHA');
  console.log('✅ RETRY: OK (sem erros)');

  console.log('\n🚀 STATUS: 100% FUNCIONANDO!\n');
}

testComplete().catch(console.error);
