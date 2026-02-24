/**
 * Teste: Atualizar Status de Tarefa
 */

import { config } from 'dotenv';
config({ path: '.env' });

import Anthropic from '@anthropic-ai/sdk';
import { ContextStore } from './packages/core/src/chat/ContextStore';
import { ChatService } from './packages/core/src/chat/ChatService';
import { initializeClickUpClient, initializeClickUpQueryService } from './packages/integrations/src/clickup/index';

async function testStatusUpdate() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║  TESTE: ATUALIZAR STATUS DE TAREFA              ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const token = process.env.CLICKUP_API_TOKEN;
  const listId = process.env.CLICKUP_DEFAULT_LIST_ID || process.env.CLICKUP_ID_LIST;
  const teamId = process.env.CLICKUP_TEAM_ID;
  const userId = process.env.CLICKUP_USER_ID ? parseInt(process.env.CLICKUP_USER_ID) : 164632817;

  if (!token || !listId) {
    console.error('❌ Credenciais faltando');
    process.exit(1);
  }

  const claude = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY,
  });

  const contextStore = new ContextStore();
  const clickupClient = initializeClickUpClient(token, listId);
  const queryService = initializeClickUpQueryService(clickupClient, teamId || '', listId, userId);

  const chatService = new ChatService(claude, contextStore, queryService);

  const sessionId = 'test-status-update-' + Date.now();

  // Teste 1: Detecção de UPDATE intent
  console.log('📊 TESTE 1: Detectar UPDATE intent');
  console.log('─'.repeat(50));

  const testMessages = [
    'Altere Charms Sandálias para concluído',
    'Mude o status de "Jack Shoes" para em andamento',
    'Quero que o status de Luzanni vire "aguardando"',
    'Tarefas para hoje', // Não é UPDATE
  ];

  testMessages.forEach(msg => {
    const isUpdate = (chatService as any).isStatusUpdateQuery(msg);
    console.log(`${isUpdate ? '✅' : '❌'} "${msg}"`);
  });

  // Teste 2: Extrair detalhes
  console.log('\n📊 TESTE 2: Extrair task name + novo status');
  console.log('─'.repeat(50));

  const updateMessage = 'Altere Charms Sandálias para concluído';
  const extracted = (chatService as any).extractStatusUpdate(updateMessage);
  console.log(`Mensagem: "${updateMessage}"`);
  console.log(`Tarefa extraída: "${extracted.taskName}"`);
  console.log(`Status extraído: "${extracted.newStatus}"`);

  // Teste 3: Processar update request
  console.log('\n📊 TESTE 3: Processar UPDATE request');
  console.log('─'.repeat(50));

  const result = await chatService.handleTaskStatusUpdate({
    text: 'Altere Charms Sandálias para concluído',
    sessionId: sessionId,
  });

  console.log(`Status: ${result.status}`);
  console.log(`Preview:\n${result.preview}`);

  // Teste 4: Confirmar e executar
  console.log('\n📊 TESTE 4: Confirmar execução');
  console.log('─'.repeat(50));

  const confirmResult = await chatService.confirmAndExecuteStatusUpdate(sessionId, true);
  console.log(`Status: ${confirmResult.status}`);
  console.log(`Resultado:\n${confirmResult.preview}`);

  console.log('\n🎉 TESTES COMPLETOS!\n');
}

testStatusUpdate().catch(console.error);
