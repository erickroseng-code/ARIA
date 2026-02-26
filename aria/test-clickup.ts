import { ClickUpClient } from './packages/integrations/src/clickup/ClickUpClient';
import { config } from 'dotenv';
config();

async function run() {
    const c = new ClickUpClient(process.env.CLICKUP_API_KEY!, process.env.CLICKUP_LIST_ID!);
    const t = await c.getTasksByAssignee(process.env.CLICKUP_TEAM_ID!, 164632817);
    console.log('Success:', t.length, 'tasks');
}

run().catch(console.error);
