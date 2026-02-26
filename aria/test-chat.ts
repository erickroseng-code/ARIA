import { ChatService, contextStore } from './packages/core/src/chat/ChatService';
import { initializeClickUpClient, initializeClickUpQueryService, getClickUpQueryService } from './packages/integrations/src/index';

import { config } from 'dotenv';
config();

async function main() {
    const clickupApiKey = process.env.CLICKUP_API_KEY;
    const clickupListId = process.env.CLICKUP_LIST_ID;
    const clickupTeamId = process.env.CLICKUP_TEAM_ID;
    const clickupUserId = 164632817;

    if (clickupApiKey && clickupListId) {
        const clickupClient = initializeClickUpClient(clickupApiKey, clickupListId);
        initializeClickUpQueryService(clickupClient, clickupTeamId ?? '', clickupListId, clickupUserId);
        console.log('[test] ClickUp integration initialized ✓');
    } else {
        console.log('[test] Missing ClickUp envs');
        return;
    }

    const qs = getClickUpQueryService();
    console.log('QueryService initialized globally:', !!qs);

    const mockAnthropic = {
        messages: {
            stream: (params: any) => {
                console.log('\n--- SYSTEM PROMPT GIVEN TO ANTHROPIC ---\n');
                console.log(params.system);
                console.log('\n----------------------------------------\n');
                return (async function* () { yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'mock' } } })();
            }
        }
    };

    const mockContextStore = {
        get: async () => ({ history: [] }),
        append: async () => { },
        getActiveClient: async () => null,
    };

    const chat = new ChatService(mockAnthropic as any, mockContextStore as any);
    const stream = chat.streamResponse('quais sao meus clientes em andamento?', 'test-session-local');

    for await (const chunk of stream) {
        // consume
    }
}

main().catch(console.error);
