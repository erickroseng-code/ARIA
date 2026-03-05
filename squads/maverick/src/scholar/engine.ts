import { DocumentParser, DocumentChunk } from './parsers';
import { EmbeddingService } from './embedding-service';
import { VectorStore } from './vector-store';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load env vars from maverick's own .env
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    const config = dotenv.parse(fs.readFileSync(envPath));
    for (const k in config) process.env[k] = config[k];
}

export class ScholarEngine {
    private chunks: DocumentChunk[] = [];
    private readonly parser: DocumentParser;
    private readonly knowledgeDir: string;
    private readonly vectorStore: VectorStore;
    private readonly embedder: EmbeddingService | null;

    constructor() {
        this.parser = new DocumentParser();
        this.knowledgeDir = path.resolve(__dirname, '../../data/knowledge');
        this.vectorStore = new VectorStore(this.knowledgeDir);

        const googleKey = process.env.GOOGLE_AI_KEY;
        this.embedder = googleKey ? new EmbeddingService(googleKey) : null;

        if (!fs.existsSync(this.knowledgeDir)) {
            fs.mkdirSync(this.knowledgeDir, { recursive: true });
        }
    }

    async loadKnowledgeBase(): Promise<void> {
        if (this.embedder) {
            const fingerprint = this.computeFingerprint(this.knowledgeDir);

            if (this.vectorStore.isFresh(fingerprint)) {
                // Cache is up-to-date — load from disk instantly
                this.vectorStore.load();
                return;
            }

        }

        // Parse all files recursively
        this.chunks = await this.parseDirectory(this.knowledgeDir);

        if (!this.embedder || this.chunks.length === 0) return;

        const texts = this.chunks.map(c => c.content);
        const vectors = await this.embedder.embedPassages(texts);

        const records = this.chunks.map(c => ({
            source: c.source,
            content: c.content,
            tags: c.tags,
        }));

        this.vectorStore.save(vectors, records);
        this.vectorStore.saveFingerprint(this.computeFingerprint(this.knowledgeDir));
    }

    // Fingerprint: sorted list of "filepath:size:mtime" for all supported files
    private computeFingerprint(dir: string): string {
        const entries: string[] = [];
        this.collectFileStats(dir, entries);
        return entries.sort().join('|');
    }

    private collectFileStats(dir: string, entries: string[]): void {
        let files: string[];
        try {
            files = fs.readdirSync(dir);
        } catch {
            return;
        }

        for (const file of files) {
            if (file.startsWith('.')) continue;
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                this.collectFileStats(fullPath, entries);
            } else {
                const ext = file.split('.').pop()?.toLowerCase();
                const supported = ['pdf', 'docx', 'txt', 'md'];
                if (ext && supported.includes(ext)) {
                    entries.push(`${fullPath}:${stat.size}:${stat.mtimeMs}`);
                }
            }
        }
    }

    async search(query: string, limit = 5): Promise<DocumentChunk[]> {
        // Semantic search (primary)
        if (this.embedder && this.vectorStore.isLoaded()) {
            const queryVec = await this.embedder.embedQuery(query);
            const results = this.vectorStore.search(queryVec, limit);
            if (results.length > 0) return results.map(r => r.chunk);
        }

        // Keyword fallback
        return this.keywordSearch(query, limit);
    }

    // Recursively parses all supported files (fixes original bug — only root was scanned)
    private async parseDirectory(dir: string): Promise<DocumentChunk[]> {
        const chunks: DocumentChunk[] = [];
        let entries: string[];

        try {
            entries = fs.readdirSync(dir);
        } catch {
            return chunks;
        }

        for (const entry of entries) {
            if (entry.startsWith('.')) continue; // skip hidden files and our own cache

            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                const sub = await this.parseDirectory(fullPath);
                chunks.push(...sub);
            } else {
                const ext = entry.split('.').pop()?.toLowerCase();
                const supported = ['pdf', 'docx', 'txt', 'md'];
                if (!ext || !supported.includes(ext)) continue; // silently skip yaml, db, bin, etc.
                try {
                    const fileChunks = await this.parser.parseFile(fullPath);
                    chunks.push(...fileChunks);
                } catch (e) {
                    console.warn(`⚠️ Falha ao ler ${entry}:`, (e as Error).message);
                }
            }
        }

        return chunks;
    }

    private keywordSearch(query: string, limit: number): DocumentChunk[] {
        const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        return this.chunks
            .map(chunk => ({
                chunk,
                score: keywords.filter(q => chunk.content.toLowerCase().includes(q)).length,
            }))
            .sort((a, b) => b.score - a.score)
            .filter(item => item.score > 0)
            .slice(0, limit)
            .map(item => item.chunk);
    }
}
