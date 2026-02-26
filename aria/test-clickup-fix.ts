import { ClickUpClient } from './packages/integrations/src/clickup/ClickUpClient';

const main = async () => {
  const apiToken = 'pk_164632817_W7PPYR6FKSE3QI4G3YL6E7B3HFLKN40Y';
  const listId = '90132644838';
  
  const client = new ClickUpClient(apiToken, listId);
  
  console.log('\n=== TEST: ClickUp getTasksByAssignee ===\n');
  console.log('[TEST] Calling getTasksByAssignee with:');
  console.log('  - teamId: 90132644838');
  console.log('  - assigneeId: 164632817');
  
  try {
    const tasks = await client.getTasksByAssignee('90132644838', 164632817);
    console.log('\n✅ SUCCESS!');
    console.log('[TEST] Tasks retrieved:', tasks.length);
    if (tasks.length > 0) {
      console.log('[TEST] First task:', tasks[0].name);
    }
  } catch (error) {
    console.error('\n❌ FAILED!');
    console.error('[TEST] Error:', error instanceof Error ? error.message : error);
  }
};

main().catch(console.error);
