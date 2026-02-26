import fs from 'fs';
import path from 'path';
const pdfParse = require('pdf-parse');
// @ts-ignore
import { pipeline, env } from '@xenova/transformers';
import { db } from '../db';
import dotenv from 'dotenv';

dotenv.config();

// Configure Transformers.js
env.localModelPath = path.resolve(__dirname, '../../../../../data/knowledge/models');
env.allowRemoteModels = true;

const BILINGUAL_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const CHUNK_SIZE = 1000;
const OVERLAP = 200;

// ─── Folder sources ────────────────────────────────────────────────────────
// Each entry defines a folder to scan and the category tag to apply to its chunks.
// To add a new folder, just push a new entry here.
const KNOWLEDGE_SOURCES: { dir: string; category: string; label: string }[] = [
    {
        dir: path.resolve(__dirname, '../../../../../data/knowledge/books'),
        category: 'analysis',
        label: 'Analysis Books',
    },
    {
        dir: path.resolve(__dirname, '../../../../../data/knowledge/copywriting/frameworks'),
        category: 'copywriting',
        label: 'Copywriting Frameworks',
    },
];

// ─── Main ingestion pipeline ───────────────────────────────────────────────
export async function ingestKnowledgeBase(filterCategory?: string) {
    console.log('[Maverick Scholar] Starting Knowledge Ingestion Pipeline...');

    // Load the embedding model once (cached after first download)
    console.log(`[Maverick Scholar] Loading Embedding Model: ${BILINGUAL_MODEL}`);
    const extractor = await pipeline('feature-extraction', BILINGUAL_MODEL, { quantized: true });

    const insertStmt = db.prepare(`
    INSERT INTO knowledge_chunks (source_file, content, embedding_json, category)
    VALUES (?, ?, ?, ?)
  `);

    const sources = filterCategory
        ? KNOWLEDGE_SOURCES.filter(s => s.category === filterCategory)
        : KNOWLEDGE_SOURCES;

    for (const source of sources) {
        if (!fs.existsSync(source.dir)) {
            console.warn(`[Maverick Scholar] Folder not found, skipping: ${source.dir}`);
            continue;
        }

        const files = fs.readdirSync(source.dir).filter(f => f.endsWith('.pdf'));
        console.log(`\n[Maverick Scholar] [${source.label}] Found ${files.length} PDFs in ${source.dir}`);

        for (const file of files) {
            const filePath = path.join(source.dir, file);

            // Skip files already ingested with this category
            const existing = db
                .prepare("SELECT COUNT(*) as count FROM knowledge_chunks WHERE source_file = ? AND category = ?")
                .get(file, source.category) as { count: number };

            if (existing.count > 0) {
                console.log(`[Maverick Scholar] Skipping ${file} [${source.category}] - already in database.`);
                continue;
            }

            console.log(`[Maverick Scholar] Reading: ${file} → category: ${source.category}`);
            const dataBuffer = fs.readFileSync(filePath);

            try {
                const data = await pdfParse(dataBuffer);
                const text = data.text.replace(/\n+/g, ' ').trim();
                const chunks = chunkText(text, CHUNK_SIZE, OVERLAP);
                console.log(`  - ${chunks.length} chunks. Vectorizing...`);

                db.exec('BEGIN TRANSACTION');
                let count = 0;
                for (const chunk of chunks) {
                    if (!chunk || chunk.length < 50) continue;
                    try {
                        const output = await extractor(chunk, { pooling: 'mean', normalize: true });
                        const vector = Array.from(output.data);
                        insertStmt.run(file, chunk, JSON.stringify(vector), source.category);
                        count++;
                        if (count % 50 === 0) console.log(`    - Vectorized ${count}/${chunks.length}...`);
                    } catch (embedErr) {
                        console.error(`  - Failed to vectorize chunk:`, embedErr);
                    }
                }
                db.exec('COMMIT');
                console.log(`[Maverick Scholar] ✅ Ingested: ${file} (${count} chunks, category=${source.category})`);
            } catch (error) {
                console.error(`[Maverick Scholar] Error parsing ${file}:`, error);
                try { db.exec('ROLLBACK'); } catch { }
            }
        }
    }

    console.log('\n[Maverick Scholar] Ingestion Complete!');
}

function chunkText(text: string, size: number, overlap: number): string[] {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + size));
        i += size - overlap;
    }
    return chunks;
}

// If run directly via ts-node, check for optional --category flag
if (require.main === module) {
    const categoryArg = process.argv.find(a => a.startsWith('--category='))?.split('=')[1];
    if (categoryArg) console.log(`[Maverick Scholar] Running ingestion for category: ${categoryArg}`);

    ingestKnowledgeBase(categoryArg)
        .then(() => process.exit(0))
        .catch(e => {
            console.error(e);
            process.exit(1);
        });
}
