const { google } = require('googleapis');
const axios = require('axios');
const { Client } = require('@notionhq/client');

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
        const response = await axios.get('https://api.clickup.com/api/v2/user', {
            headers: { 'Authorization': token.trim() }
        });
        console.log(`✅ ClickUp API reachable. User: ${response.data.user.username}`);

        if (listId) {
            try {
                const listRes = await axios.get(`https://api.clickup.com/api/v2/list/${listId.trim()}`, {
                    headers: { 'Authorization': token.trim() }
                });
                console.log(`✅ ClickUp List ${listId} accessible: ${listRes.data.name}`);
            } catch (e) {
                console.log(`⚠️ ClickUp List ${listId} NOT accessible: ${e.message}`);
            }
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
        const notion = new Client({ auth: token.trim() });
        const response = await notion.users.getMe({});
        console.log(`✅ Notion API reachable. Bot Name: ${response.name}`);
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
