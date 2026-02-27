const https = require('https');
const { google } = require('googleapis');
const { Client } = require('@notionhq/client');

function request(url, options = {}) {
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
    console.log('\n--- Google Workspace Validation ---');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        console.log('❌ Missing Google credentials in .env');
        return;
    }

    try {
        const auth = new google.auth.OAuth2(clientId, clientSecret);
        auth.setCredentials({ refresh_token: refreshToken });
        const { token } = await auth.getAccessToken();
        console.log('✅ Google Access Token refreshed successfully.');

        const calendar = google.calendar({ version: 'v3', auth });
        const res = await calendar.calendarList.list();
        console.log(`✅ Google Calendar API reachable. Found ${res.data.items.length} calendars.`);
    } catch (e) {
        console.log(`❌ Google Validation FAILED: ${e.message}`);
    }
}

async function validateClickUp() {
    console.log('\n--- ClickUp Validation ---');
    const token = process.env.CLICKUP_API_TOKEN;
    const listId = process.env.CLICKUP_DEFAULT_LIST_ID || process.env.CLICKUP_ID_LIST;

    if (!token) {
        console.log('❌ CLICKUP_API_TOKEN not set.');
        return;
    }

    try {
        const response = await request('https://api.clickup.com/api/v2/user', {
            headers: { 'Authorization': token.trim() }
        });
        if (response.status === 200) {
            console.log(`✅ ClickUp API reachable. User: ${response.data.user.username}`);
            if (listId) {
                const listRes = await request(`https://api.clickup.com/api/v2/list/${listId.trim()}`, {
                    headers: { 'Authorization': token.trim() }
                });
                if (listRes.status === 200) {
                    console.log(`✅ ClickUp List ${listId} accessible: ${listRes.data.name}`);
                } else {
                    console.log(`⚠️ ClickUp List ${listId} NOT accessible (Status: ${listRes.status})`);
                }
            }
        } else {
            console.log(`❌ ClickUp API returned Status ${response.status}: ${JSON.stringify(response.data)}`);
        }
    } catch (e) {
        console.log(`❌ ClickUp Validation FAILED: ${e.message}`);
    }
}

async function validateNotion() {
    console.log('\n--- Notion Validation ---');
    const token = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
    if (!token) {
        console.log('❌ NOTION_TOKEN not set.');
        return;
    }

    try {
        // Use native request instead of Client if not found, but it should be in integrations
        const response = await request('https://api.notion.com/v1/users/me', {
            headers: {
                'Authorization': `Bearer ${token.trim()}`,
                'Notion-Version': '2022-06-28'
            }
        });
        if (response.status === 200) {
            console.log(`✅ Notion API reachable. Bot/User: ${response.data.name}`);
        } else {
            console.log(`❌ Notion API returned Status ${response.status}: ${JSON.stringify(response.data)}`);
        }
    } catch (e) {
        console.log(`❌ Notion Validation FAILED: ${e.message}`);
    }
}

async function run() {
    await validateGoogle();
    await validateClickUp();
    await validateNotion();
}

run();
