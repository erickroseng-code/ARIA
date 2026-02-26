import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure the data directory exists
const dataDir = path.resolve(__dirname, '../../../../data/knowledge');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database stored inside data/knowledge
const dbPath = path.join(dataDir, 'scholar.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

console.log(`[Maverick DB] Connected to SQLite database at ${dbPath}`);

// Setup the Schema for the RAG engine
export function initDB() {
  // Create the table (without the category column in case it's a fresh DB)
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_file TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_source ON knowledge_chunks(source_file);
  `);

  // Safe migration: add category column if it doesn't exist (runs on both new and existing DBs)
  try {
    db.exec(`ALTER TABLE knowledge_chunks ADD COLUMN category TEXT NOT NULL DEFAULT 'analysis'`);
    console.log('[Maverick DB] Migration: added category column.');
  } catch {
    // Column already exists — expected on databases that already ran this migration
  }

  // Create the category index now that the column is guaranteed to exist
  try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_category ON knowledge_chunks(category)`);
  } catch {
    // Index may already exist
  }

  console.log('[Maverick DB] Knowledge DB initialized.');
}

initDB();
