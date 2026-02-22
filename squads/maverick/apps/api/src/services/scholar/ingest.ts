import fs from 'fs';
import path from 'path';
const pdfParse = require('pdf-parse');
// @ts-ignore
import { pipeline, env } from '@xenova/transformers';
import { db } from '../db';
import dotenv from 'dotenv';

dotenv.config();

// Configure Transformers.js to not use remote models if downloaded, and set cache dir
env.localModelPath = path.resolve(__dirname, '../../../../../data/knowledge/models');
env.allowRemoteModels = true; // Allow downloading on first run

// To handle both PT-BR and EN docs, we use a multilingual tiny model
const BILINGUAL_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
const CHUNK_SIZE = 1000;
const OVERLAP = 200;

export async function ingestKnowledgeBase() {
    console.log('[Maverick Scholar] Starting Knowledge Ingestion Pipeline...');
    const booksDir = path.resolve(__dirname, '../../../../../data/knowledge/books');

    if (!fs.existsSync(booksDir)) {
        console.error(`[Maverick Scholar] Directory not found: ${booksDir}`);
        return;
    }

    const files = fs.readdirSync(booksDir).filter(f => f.endsWith('.pdf'));
    console.log(`[Maverick Scholar] Found ${files.length} PDFs to process.`);

    // Load the embedding model (downloads first time, then cached)
    console.log(`[Maverick Scholar] Loading Embedding Model: ${BILINGUAL_MODEL} (Bilingual PT/EN support)`);
    const extractor = await pipeline('feature-extraction', BILINGUAL_MODEL, {
        quantized: true // makes it faster and lighter for nodejs
    });

    const insertStmt = db.prepare(`
    INSERT INTO knowledge_chunks (source_file, content, embedding_json)
    VALUES (?, ?, ?)
  `);

    for (const file of files) {
        const filePath = path.join(booksDir, file);

        // Check if we already processed this file
        const existing = db.prepare('SELECT COUNT(*) as count FROM knowledge_chunks WHERE source_file = ?').get(file) as { count: number };
        if (existing.count > 0) {
            console.log(`[Maverick Scholar] Skipping ${file} - already in database.`);
            continue;
        }

        console.log(`[Maverick Scholar] Reading: ${file}`);
        const dataBuffer = fs.readFileSync(filePath);
        try {
            const data = await pdfParse(dataBuffer);
            const text = data.text.replace(/\n+/g, ' ').trim();

            const chunks = chunkText(text, CHUNK_SIZE, OVERLAP);
            console.log(`[Maverick Scholar] Created ${chunks.length} chunks for ${file}. Generating embeddings...`);

            // We run embeddings sequentially to avoid blowing up memory
            db.exec('BEGIN TRANSACTION');
            let count = 0;
            for (const chunk of chunks) {
                if (!chunk || chunk.length < 50) continue;

                try {
                    const output = await extractor(chunk, { pooling: 'mean', normalize: true });
                    // Convert Float32Array to regular array for JSON
                    const vector = Array.from(output.data);

                    insertStmt.run(file, chunk, JSON.stringify(vector));
                    count++;
                    if (count % 50 === 0) console.log(`  - Vectorized ${count}/${chunks.length} chunks...`);
                } catch (embedError) {
                    console.error(`  - Failed to vector chunk:`, embedError);
                }
            }
            db.exec('COMMIT');

            console.log(`[Maverick Scholar] Successfully ingested ${file}`);
        } catch (error) {
            console.error(`[Maverick Scholar] Error Parsing ${file}:`, error);
            try { db.exec('ROLLBACK'); } catch (e) { }
        }
    }

    console.log('[Maverick Scholar] Ingestion Complete!');
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

// If run directly via ts-node, execute the pipeline
if (require.main === module) {
    ingestKnowledgeBase()
        .then(() => process.exit(0))
        .catch(e => {
            console.error(e);
            process.exit(1);
        });
}
