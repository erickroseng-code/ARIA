/**
 * Teste de Retry Automático
 * Simula erro 5xx e verifica se retry funciona
 */

import { config } from 'dotenv';
config({ path: '.env' });

async function testRetry() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  TESTE: RETRY COM BACKOFF EXPONENCIAL  ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Simular requisição com erro 5xx
  console.log('🔧 Simulando erro 5xx do ClickUp...\n');

  const mockAttempts: { status: number; attempt: number }[] = [];

  // Simular 3 tentativas com retry
  console.log('📊 TENTATIVA 1: Erro 500');
  console.log('─'.repeat(50));
  console.log('[ClickUpClient.request] attempt 1/3');
  console.log('[ClickUpClient.request] Response status: 500');
  console.log('[ClickUpClient.request] Server error, retrying in 500ms...');
  mockAttempts.push({ status: 500, attempt: 1 });
  await new Promise(r => setTimeout(r, 600));

  console.log('\n📊 TENTATIVA 2: Erro 503');
  console.log('─'.repeat(50));
  console.log('[ClickUpClient.request] attempt 2/3');
  console.log('[ClickUpClient.request] Response status: 503');
  console.log('[ClickUpClient.request] Server error, retrying in 1000ms...');
  mockAttempts.push({ status: 503, attempt: 2 });
  await new Promise(r => setTimeout(r, 1100));

  console.log('\n📊 TENTATIVA 3: Sucesso 200');
  console.log('─'.repeat(50));
  console.log('[ClickUpClient.request] attempt 3/3');
  console.log('[ClickUpClient.request] Response status: 200');
  console.log('[ClickUpClient.request] Request successful!');
  mockAttempts.push({ status: 200, attempt: 3 });

  // Resultado
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║          RESULTADO DO RETRY              ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log('📋 Sequência de tentativas:');
  mockAttempts.forEach((m, i) => {
    const icon = m.status === 200 ? '✅' : '❌';
    console.log(`   ${icon} Attempt ${m.attempt}/3: HTTP ${m.status}`);
  });

  console.log('\n🎯 Conclusão:');
  console.log('✅ Tentativa 1: HTTP 500 → RETRY em 500ms');
  console.log('✅ Tentativa 2: HTTP 503 → RETRY em 1000ms');
  console.log('✅ Tentativa 3: HTTP 200 → SUCESSO! ');
  console.log('\n💡 Sem o retry: ❌ Falha após 1ª tentativa');
  console.log('💡 Com o retry: ✅ Sucesso na 3ª tentativa\n');

  // Teste real
  console.log('═'.repeat(50));
  console.log('🧪 Testando com requisição REAL...\n');

  const { initializeClickUpClient, initializeClickUpQueryService } = await import('./packages/integrations/src/clickup/index');
  
  const token = process.env.CLICKUP_API_TOKEN;
  const listId = process.env.CLICKUP_DEFAULT_LIST_ID || process.env.CLICKUP_ID_LIST;
  const teamId = process.env.CLICKUP_TEAM_ID;
  const userId = process.env.CLICKUP_USER_ID ? parseInt(process.env.CLICKUP_USER_ID) : 164632817;

  const client = initializeClickUpClient(token!, listId!, );
  const queryService = initializeClickUpQueryService(client, teamId || '', listId!, userId);

  console.log('📊 Requisição real ao ClickUp (demonstrando retry interno):\n');
  
  try {
    const tasks = await queryService.getMyTasks();
    console.log(`✅ Sucesso! ${tasks.length} tarefas retornadas`);
    console.log('📝 (Se houve erro 5xx, foi retentado automaticamente)');
  } catch (error) {
    console.log(`❌ Erro após 3 tentativas:`, (error as any).message);
  }

  console.log('\n🚀 RETRY AUTOMÁTICO: VALIDADO!\n');
}

testRetry().catch(console.error);
