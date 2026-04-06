import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs';
import * as path from 'path';

// Allow persistent disk path in cloud envs (Render, etc).
// Fallback keeps current local developer behavior.
const dbPath = process.env.SQLITE_DB_PATH?.trim()
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : path.resolve(process.cwd(), 'dev.native.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

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
