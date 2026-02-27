import { google } from 'googleapis';
import { Client as NotionClient } from '@notionhq/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as https from 'https';

// Load env from root
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

function request(url: string, options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, data: json });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });
        req.on('error', (e) => reject(e));
        if (options.body) req.write(JSON.stringify(options.body));
        req.end();
    });
}

async function validateGoogle() {
    console.log('\n--- 1. Google Workspace Validation ---');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        console.log('❌ Missing Google credentials (ID/Secret/RefreshToken) in .env');
        return;
    }

    try {
        const auth = new google.auth.OAuth2(clientId, clientSecret);
        auth.setCredentials({ refresh_token: refreshToken });

        console.log('Refreshing token...');
        const { token } = await auth.getAccessToken();
        if (!token) throw new Error('Refresh failed - no access token returned');

        console.log('✅ Google Access Token refreshed successfully.');

        const calendar = google.calendar({ version: 'v3', auth });

        // Test LIST
        const listRes = await calendar.calendarList.list();
        console.log(`✅ Google Calendar API reachable. Found ${listRes.data.items?.length || 0} calendars.`);

        // Test CREATE
        console.log('Attempting to CREATE a test event...');
        const now = new Date();
        const start = now.toISOString();
        const end = new Date(now.getTime() + 3600000).toISOString(); // +1 hour

        const createRes = await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
                summary: 'ARIA Diagnostic Test Event',
                description: 'Temporary event for integration verification',
                start: { dateTime: start, timeZone: 'America/Sao_Paulo' },
                end: { dateTime: end, timeZone: 'America/Sao_Paulo' },
            },
        });

        const eventId = createRes.data.id;
        console.log(`✅ Test Event CREATED successfully. ID: ${eventId}`);

        // Test DELETE
        if (eventId) {
            console.log(`Attempting to DELETE test event ${eventId}...`);
            await calendar.events.delete({
                calendarId: 'primary',
                eventId: eventId,
            });
            console.log('✅ Test Event DELETED successfully.');
        }

    } catch (e: any) {
        console.log(`❌ Google Validation FAILED: ${e.message}`);
        if (e.response?.data) {
            console.log(`   Detailed Error: ${JSON.stringify(e.response.data)}`);
        }
        if (e.message.includes('invalid_grant')) {
            console.log('💡 Tip: The Refresh Token might be expired or revoked. Please re-authorize.');
        }
    }
}

async function validateClickUp() {
    console.log('\n--- 2. ClickUp Validation ---');
    const token = (process.env.CLICKUP_API_TOKEN || '').trim();
    const rawListId = (process.env.CLICKUP_DEFAULT_LIST_ID || process.env.CLICKUP_ID_LIST || '').trim();

    if (!token) {
        console.log('❌ CLICKUP_API_TOKEN not set in .env');
        return;
    }

    try {
        const response = await request('https://api.clickup.com/api/v2/user', {
            headers: { 'Authorization': token }
        });
        if (response.status === 200) {
            console.log(`✅ ClickUp API reachable. User: ${response.data.user.username} (#${response.data.user.id})`);

            if (rawListId) {
                // Try the list ID as is, and also try stripping any non-numeric parts if it fails
                const listIdsToTry = [rawListId];
                const numericOnly = rawListId.replace(/\D/g, '');
                if (numericOnly && numericOnly !== rawListId) listIdsToTry.push(numericOnly);

                for (const listId of listIdsToTry) {
                    console.log(`Testing List ID: "${listId}"`);
                    const listRes = await request(`https://api.clickup.com/api/v2/list/${listId}`, {
                        headers: { 'Authorization': token }
                    });
                    if (listRes.status === 200) {
                        console.log(`✅ ClickUp List ${listId} accessible: ${listRes.data.name}`);
                        return; // Found a working one
                    } else {
                        console.log(`⚠️ ClickUp List "${listId}" NOT accessible (Status: ${listRes.status})`);
                    }
                }
            } else {
                console.log('⚠️ No ClickUp List ID configured in .env');
            }
        } else {
            console.log(`❌ ClickUp API returned Status ${response.status}: ${JSON.stringify(response.data)}`);
        }
    } catch (e: any) {
        console.log(`❌ ClickUp Validation FAILED: ${e.message}`);
    }
}

async function validateNotion() {
    console.log('\n--- 3. Notion Validation ---');
    const token = (process.env.NOTION_TOKEN || process.env.NOTION_API_KEY || '').trim();

    if (!token) {
        console.log('❌ NOTION_TOKEN or NOTION_API_KEY not set in .env');
        return;
    }

    try {
        const notion = new NotionClient({ auth: token });
        // Correct method in newer @notionhq/client versions is users.me()
        const response = await (notion.users as any).me({});
        console.log(`✅ Notion API reachable. Internal Bot/User: ${response.name}`);
    } catch (e: any) {
        console.log(`❌ Notion Validation FAILED: ${e.message}`);
        console.log('Trying alternative Notion check (users.list)...');
        try {
            const notion = new NotionClient({ auth: token });
            const listRes = await notion.users.list({});
            console.log(`✅ Notion API reachable via users.list. Found ${listRes.results?.length || 0} users.`);
        } catch (e2: any) {
            console.log(`❌ Alternative check also failed: ${e2.message}`);
        }
    }
}

async function run() {
    console.log('Starting Live API Diagnostic...');
    await validateGoogle();
    await validateClickUp();
    await validateNotion();
    console.log('\nDiagnostic Complete.');
}

run().catch(err => {
    console.error('Fatal diagnostic error:', err);
    process.exit(1);
});
