import { config } from 'dotenv';
import * as path from 'path';
config({ path: path.resolve(__dirname, '../../../.env') });

import { GmailService, DriveService, isWorkspaceConfigured } from '@aria/integrations';

async function test() {
    console.log('Is Workspace Configured?', isWorkspaceConfigured());
    try {
        console.log('\n--- Testing Gmail API ---');
        const gmail = new GmailService();
        const emails = await gmail.listRecentEmails(2, false);
        console.log('Subjets found:', emails.map(e => e.subject).join(', ') || 'No emails found');

        console.log('\n--- Testing Drive API ---');
        const drive = new DriveService();
        const files = await drive.listRecentFiles(2);
        console.log('Files found:', files.map(f => f.name).join(', ') || 'No files found');

        console.log('\n✅ INTEGRATIONS SUCCESSFUL');
    } catch (e) {
        console.error('\n❌ Error accessing APIs:', e instanceof Error ? e.message : String(e));
    }
}
test();
