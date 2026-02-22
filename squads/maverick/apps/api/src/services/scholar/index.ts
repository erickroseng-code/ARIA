import path from 'path';
// @ts-ignore
import { pipeline, env } from '@xenova/transformers';
import { db } from '../db';
import dotenv from 'dotenv';

dotenv.config();

env.localModelPath = path.resolve(__dirname, '../../../../../data/knowledge/models');
env.allowRemoteModels = true; // Use cached model if exists

const BILINGUAL_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

// Utility for Cosine Similarity math between two arrays of numbers
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface SearchResult {
    id: number;
    source_file: string;
    content: string;
    similarity: number;
}

export class ScholarAgent {
    private extractor: any = null;

    async initModel() {
        if (!this.extractor) {
            console.log(`[Maverick Scholar] Booting local embedding engine: ${BILINGUAL_MODEL}`);
            this.extractor = await pipeline('feature-extraction', BILINGUAL_MODEL, { quantized: true });
        }
    }

    async searchKnowledge(query: string, topK: number = 3): Promise<SearchResult[]> {
        await this.initModel();

        console.log(`[Maverick Scholar] Searching knowledge base for: "${query}"`);

        // 1. Convert Search Query into Vector
        const output = await this.extractor(query, { pooling: 'mean', normalize: true });
        const queryVector = Array.from(output.data) as number[];

        // 2. Fetch all chunks from SQLite
        // Note: In a production app with 1M rows, use pgvector or chromadb. For local testing, 
        // retrieving all and calculating cosine similarity in JS is surprisingly fast for standard books.
        const allChunks = db.prepare('SELECT id, source_file, content, embedding_json FROM knowledge_chunks').all() as any[];

        // 3. Calculate Cosine Similarity for each chunk
        const results: SearchResult[] = [];
        for (const chunk of allChunks) {
            const chunkVector = JSON.parse(chunk.embedding_json);
            const similarity = cosineSimilarity(queryVector, chunkVector);

            results.push({
                id: chunk.id,
                source_file: chunk.source_file,
                content: chunk.content,
                similarity
            });
        }

        // 4. Sort by highest similarity and take topK
        results.sort((a, b) => b.similarity - a.similarity);
        const topResults = results.slice(0, topK);

        console.log(`[Maverick Scholar] Found ${topResults.length} relevant chunks.`);
        return topResults;
    }
}
