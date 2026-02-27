const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

console.log('--- START DIAGNOSTIC ---');

// 1. Check .env existence and variables directly
console.log('\n[1] Environment Variables (process.env):');
const vars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'CLICKUP_API_TOKEN', 'CLICKUP_DEFAULT_LIST_ID', 'TELEGRAM_BOT_TOKEN'];
vars.forEach(v => {
    const val = process.env[v];
    if (val) {
        console.log(`${v}: SET (Starts with: ${val.trim().substring(0, 10)}...)`);
    } else {
        console.log(`${v}: NOT SET`);
    }
});

// 2. Check Database explicitly
const dbPath = path.resolve(process.cwd(), 'dev.native.db');
console.log(`\n[2] Database check at: ${dbPath}`);
if (!fs.existsSync(dbPath)) {
    console.log('❌ dev.native.db NOT FOUND at root.');
} else {
    try {
        const db = new DatabaseSync(dbPath);
        const rows = db.prepare("SELECT provider, accessToken, refreshToken, isValid FROM integrations").all();
        console.log(`Found ${rows.length} rows in 'integrations' table:`);
        rows.forEach(r => {
            console.log(`- Provider: ${r.provider}`);
            console.log(`  Valid: ${r.isValid}`);
            console.log(`  AccessToken: ${r.accessToken ? 'YES' : 'NO'}`);
            console.log(`  RefreshToken: ${r.refreshToken ? 'YES' : 'NO'}`);
        });
    } catch (e) {
        console.log(`❌ Error reading DB: ${e.message}`);
    }
}

// 3. Try to check if server is reachable (optional/async)
console.log('\n--- END DIAGNOSTIC ---');
process.exit(0);
