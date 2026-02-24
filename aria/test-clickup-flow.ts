/**
 * ClickUp Integration Test Flow
 *
 * Este script testa o fluxo completo de integração ClickUp:
 * 1. Verifica se as credenciais estão configuradas
 * 2. Inicializa os clientes
 * 3. Testa getMyTasks
 * 4. Testa getClientPipeline
 * 5. Testa formatação para IA
 *
 * Executar: npx tsx test-clickup-flow.ts
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { initializeClickUpClient, initializeClickUpQueryService } from './packages/integrations/src/clickup/index';

async function main() {
  console.log('\n=== ClickUp Integration Test Flow ===\n');

  // 1. Verificar credenciais
  console.log('1️⃣  Verificando credenciais...');
  const token = process.env.CLICKUP_API_TOKEN;
  const listId = process.env.CLICKUP_DEFAULT_LIST_ID || process.env.CLICKUP_ID_LIST;
  const teamId = process.env.CLICKUP_TEAM_ID;
  const userId = process.env.CLICKUP_USER_ID ? parseInt(process.env.CLICKUP_USER_ID) : 164632817;

  console.log('  Token:', token ? `✅ (${token.substring(0, 10)}...)` : '❌ MISSING');
  console.log('  List ID:', listId ? `✅ ${listId}` : '❌ MISSING');
  console.log('  Team ID:', teamId ? `✅ ${teamId}` : '❌ MISSING');
  console.log('  User ID:', userId ? `✅ ${userId}` : '❌ MISSING');

  if (!token || !listId) {
    console.error('\n❌ Credenciais faltando! Configure CLICKUP_API_TOKEN e CLICKUP_DEFAULT_LIST_ID');
    process.exit(1);
  }

  // 2. Inicializar clientes
  console.log('\n2️⃣  Inicializando clientes...');
  try {
    const client = initializeClickUpClient(token, listId);
    console.log('  ✅ ClickUpClient inicializado');

    const queryService = initializeClickUpQueryService(client, teamId || '', listId, userId);
    console.log('  ✅ ClickUpQueryService inicializado');

    // 3. Testar getMyTasks
    console.log('\n3️⃣  Testando getMyTasks...');
    const myTasks = await queryService.getMyTasks();
    console.log(`  ✅ Recuperadas ${myTasks.length} tarefas`);
    if (myTasks.length > 0) {
      console.log('  Amostra:', myTasks.slice(0, 2).map(t => `"${t.name}" [${t.status}]`).join(', '));
    }

    // 4. Testar getClientPipeline (opcional - pode falhar se List ID não existe)
    console.log('\n4️⃣  Testando getClientPipeline...');
    let pipeline: any[] = [];
    try {
      pipeline = await queryService.getClientPipeline();
      console.log(`  ✅ Recuperados ${pipeline.length} clientes`);
      if (pipeline.length > 0) {
        console.log('  Amostra:', pipeline.slice(0, 2).map(c => `"${c.name}" [${c.status}]`).join(', '));
      }
    } catch (err) {
      console.log(`  ⚠️  Pipeline não disponível (List ID pode estar incorreto)`);
      console.log(`      Erro: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    // 5. Testar formatação
    console.log('\n5️⃣  Testando formatação para IA...');
    const myTasksFormatted = queryService.formatMyTasksForAI(myTasks);
    const pipelineFormatted = pipeline.length > 0 ? queryService.formatPipelineForAI(pipeline) : '';

    console.log(`  ✅ Minhas tarefas formatadas: ${myTasksFormatted.length} chars`);
    if (pipelineFormatted) {
      console.log(`  ✅ Pipeline formatado: ${pipelineFormatted.length} chars`);
    }

    console.log('\n✅ TODOS OS TESTES PASSARAM!\n');
    console.log('Exemplo de dados formatados para IA:\n');
    console.log('--- MINHAS TAREFAS ---');
    console.log(myTasksFormatted.substring(0, 500) + (myTasksFormatted.length > 500 ? '...' : ''));
    console.log('\n--- PIPELINE DE CLIENTES ---');
    console.log(pipelineFormatted.substring(0, 500) + (pipelineFormatted.length > 500 ? '...' : ''));

  } catch (error) {
    console.error('\n❌ Erro durante teste:', error);
    if (error instanceof Error) {
      console.error('   Mensagem:', error.message);
      console.error('   Stack:', error.stack?.substring(0, 300));
    }
    process.exit(1);
  }
}

main();
