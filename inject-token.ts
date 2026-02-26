import { db } from './aria/apps/api/src/config/db';

const newToken = "1//0hyMNRpA3kS4TCgYIARAAGBESNwF-L9IrV8C_qVpYLmQGheM-6ygSkL9XAzdEXLfnMODbNq2ywEvQ9HfHsCbmmAHt__DPtqhOPjw";

console.log('Injecting new refresh token into SQLite DB...');

try {
    const stmt = db.prepare(`
        INSERT INTO integrations (provider, refreshToken, accessToken, isValid, updatedAt)
        VALUES (?, ?, NULL, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(provider) DO UPDATE SET
            refreshToken = excluded.refreshToken,
            isValid = 1,
            updatedAt = CURRENT_TIMESTAMP
    `);

    stmt.run('google', newToken);
    console.log('✅ Successfully updated Google refresh token in native SQLite DB!');
} catch (error) {
    console.error('❌ Failed to update token:', error);
}
