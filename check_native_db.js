const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = path.resolve(process.cwd(), 'dev.native.db');
console.log(`Checking database at: ${dbPath}`);

try {
    const db = new DatabaseSync(dbPath);
    const rows = db.prepare("SELECT provider, accessToken, refreshToken, isValid FROM integrations").all();

    console.log('\n--- Integrations Table Content ---');
    if (rows.length === 0) {
        console.log('No integrations found in database.');
    } else {
        rows.forEach((row) => {
            console.log(`Provider: ${row.provider}`);
            console.log(`Access Token: ${row.accessToken ? 'Present (First 10: ' + row.accessToken.substring(0, 10) + '...)' : 'Missing'}`);
            console.log(`Refresh Token: ${row.refreshToken ? 'Present (First 10: ' + row.refreshToken.substring(0, 10) + '...)' : 'Missing'}`);
            console.log(`Is Valid: ${row.isValid}`);
            console.log('---------------------------------');
        });
    }
} catch (err) {
    console.error('Error accessing database:', err.message);
}

console.log('\n--- Environment Variables Check ---');
const envVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
    'CLICKUP_API_TOKEN',
    'CLICKUP_DEFAULT_LIST_ID',
    'TELEGRAM_BOT_TOKEN'
];

envVars.forEach(v => {
    const val = process.env[v];
    console.log(`${v}: ${val ? 'SET (First 5: ' + val.trim().substring(0, 5) + '...)' : 'NOT SET'}`);
});
