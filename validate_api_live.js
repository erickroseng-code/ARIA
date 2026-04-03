const { google } = require('googleapis');
const { Client } = require('@notionhq/client');

async function validateGoogle() {
    console.log('\n--- Google Workspace Validation ---');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        console.log('? Missing Google credentials in .env');
        return;
    }

    try {
        const auth = new google.auth.OAuth2(clientId, clientSecret);
        auth.setCredentials({ refresh_token: refreshToken });
        await auth.getAccessToken();
        console.log('? Google Access Token refreshed successfully.');

        const calendar = google.calendar({ version: 'v3', auth });
        const res = await calendar.calendarList.list();
        console.log(`? Google Calendar API reachable. Found ${res.data.items.length} calendars.`);
    } catch (e) {
        console.log(`? Google Validation FAILED: ${e.message}`);
    }
}

async function validateNotion() {
    console.log('\n--- Notion Validation ---');
    const token = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
    if (!token) {
        console.log('? NOTION_TOKEN not set.');
        return;
    }

    try {
        const notion = new Client({ auth: token.trim() });
        const response = await notion.users.getMe({});
        console.log(`? Notion API reachable. Bot Name: ${response.name}`);
    } catch (e) {
        console.log(`? Notion Validation FAILED: ${e.message}`);
    }
}

async function run() {
    await validateGoogle();
    await validateNotion();
}

run();
