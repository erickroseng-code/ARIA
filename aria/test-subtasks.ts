/**
 * ClickUp Subtasks Test
 *
 * Testa o novo suporte para buscar e formatar subtarefas
 * Executar: npx tsx test-subtasks.ts
 */

import { config } from 'dotenv';
config({ path: '.env' });

import { initializeClickUpClient, initializeClickUpQueryService } from './packages/integrations/src/clickup/index';

async function main() {
  console.log('\n=== ClickUp Subtasks Test ===\n');

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

  try {
    // Test 1: Tarefas simples (sem subtarefas)
    console.log('1️⃣  Buscando tarefas simples...');
    const simpleTasks = await queryService.getMyTasks();
    console.log(`  ✅ ${simpleTasks.length} tarefas encontradas`);

    // Test 2: Tarefas com subtarefas
    console.log('\n2️⃣  Buscando tarefas COM subtarefas...');
    const tasksWithSubs = await queryService.getMyTasksWithSubtasks();
    const totalWithSubs = tasksWithSubs.reduce((sum, t) => sum + (t.subtasks?.length ?? 0), 0);
    console.log(`  ✅ ${tasksWithSubs.length} tarefas com ${totalWithSubs} subtarefas no total`);

    // Test 3: Mostrar amostra
    if (tasksWithSubs.length > 0) {
      const taskWithSubs = tasksWithSubs.find(t => t.subtasks && t.subtasks.length > 0);
      if (taskWithSubs) {
        console.log(`\n  📋 Exemplo: "${taskWithSubs.name}"`);
        console.log(`     Subtarefas: ${taskWithSubs.subtasks?.length}`);
        taskWithSubs.subtasks?.slice(0, 2).forEach(sub => {
          console.log(`       ↳ [${sub.status}] ${sub.name}`);
        });
      }
    }

    // Test 4: Formatação
    console.log('\n3️⃣  Testando formatação para IA...');
    const formatted = queryService.formatMyTasksWithSubtasksForAI(
      tasksWithSubs.slice(0, 3) // Primeiras 3 tarefas
    );
    console.log(`  ✅ Formatado: ${formatted.length} chars`);
    console.log('\n📄 Preview:');
    console.log(formatted);

    console.log('\n✅ TESTES CONCLUÍDOS!\n');

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

main();
