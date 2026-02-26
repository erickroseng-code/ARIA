import { DatabaseSync } from 'node:sqlite';
import * as path from 'path';

// Provide absolute path so it runs in dev or dist safely
const dbPath = path.resolve(process.cwd(), 'dev.native.db');
export const db = new DatabaseSync(dbPath);

// Initialize the single Integration table used just for the OAuth Token persistence
db.exec(`
    CREATE TABLE IF NOT EXISTS integrations (
        provider TEXT PRIMARY KEY,
        refreshToken TEXT,
        accessToken TEXT,
        isValid INTEGER DEFAULT 1,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);
