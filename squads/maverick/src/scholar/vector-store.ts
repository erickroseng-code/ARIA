// Vector Store — binary file cache for semantic search
// Stores Float32Array vectors as raw binary (.bin) + JSON metadata
// No external database required — zero new dependencies

import * as fs from 'fs';
import * as path from 'path';
import { DocumentChunk } from './parsers';

export interface VectorRecord {
    source: string;
    content: string;
    tags: string[];
}

export interface SearchResult {
    chunk: DocumentChunk;
    score: number;
}

export class VectorStore {
    private readonly metaPath: string;
    private readonly binPath: string;
    private readonly fingerprintPath: string;
    private records: VectorRecord[] = [];
    private matrix: Float32Array | null = null;
    private dims = 512;

    constructor(cacheDir: string) {
        this.metaPath = path.join(cacheDir, '.vector-index.json');
        this.binPath = path.join(cacheDir, '.vector-index.bin');
        this.fingerprintPath = path.join(cacheDir, '.vector-fingerprint');
    }

    isLoaded(): boolean {
        return this.matrix !== null && this.records.length > 0;
    }

    isCached(): boolean {
        return fs.existsSync(this.metaPath) && fs.existsSync(this.binPath);
    }

    isFresh(currentFingerprint: string): boolean {
        if (!this.isCached()) return false;
        if (!fs.existsSync(this.fingerprintPath)) return false;
        return fs.readFileSync(this.fingerprintPath, 'utf-8').trim() === currentFingerprint;
    }

    load(): boolean {
        if (!this.isCached()) return false;
        try {
            this.records = JSON.parse(fs.readFileSync(this.metaPath, 'utf-8'));
            const buf = fs.readFileSync(this.binPath);
            // Safe copy to avoid alignment issues with Buffer
            const floatBuf = new Float32Array(buf.length / 4);
            for (let i = 0; i < floatBuf.length; i++) {
                floatBuf[i] = buf.readFloatLE(i * 4);
            }
            this.matrix = floatBuf;
            this.dims = this.matrix.length / this.records.length;
            return true;
        } catch (e) {
            console.warn('⚠️ Falha ao carregar cache vetorial:', e);
            return false;
        }
    }

    saveFingerprint(fingerprint: string): void {
        fs.writeFileSync(this.fingerprintPath, fingerprint);
    }

    save(vectors: Float32Array[], records: VectorRecord[]): void {
        if (vectors.length === 0) return;

        this.records = records;
        this.dims = vectors[0].length;

        // Write binary — each float as 4 bytes LE
        const buf = Buffer.allocUnsafe(vectors.length * this.dims * 4);
        vectors.forEach((vec, i) => {
            vec.forEach((val, j) => {
                buf.writeFloatLE(val, (i * this.dims + j) * 4);
            });
        });

        // Flatten for in-memory use
        const flat = new Float32Array(vectors.length * this.dims);
        vectors.forEach((v, i) => flat.set(v, i * this.dims));
        this.matrix = flat;

        fs.writeFileSync(this.binPath, buf);
        fs.writeFileSync(this.metaPath, JSON.stringify(records));
    }

    invalidateCache(): void {
        if (fs.existsSync(this.metaPath)) fs.unlinkSync(this.metaPath);
        if (fs.existsSync(this.binPath)) fs.unlinkSync(this.binPath);
        this.matrix = null;
        this.records = [];
    }

    search(queryVector: Float32Array, k: number, minScore = 0.3): SearchResult[] {
        if (!this.matrix || !this.records.length) return [];

        const scores: Array<{ index: number; score: number }> = [];

        for (let i = 0; i < this.records.length; i++) {
            const offset = i * this.dims;
            const score = this.dotProduct(queryVector, this.matrix, offset);
            scores.push({ index: i, score });
        }

        return scores
            .sort((a, b) => b.score - a.score)
            .slice(0, k)
            .filter(s => s.score >= minScore)
            .map(s => ({
                chunk: {
                    source: this.records[s.index].source,
                    content: this.records[s.index].content,
                    tags: this.records[s.index].tags,
                },
                score: s.score,
            }));
    }

    // Dot product on flat matrix row (= cosine similarity for normalized vectors)
    private dotProduct(a: Float32Array, matrix: Float32Array, offset: number): number {
        let sum = 0;
        for (let j = 0; j < this.dims; j++) {
            sum += a[j] * matrix[offset + j];
        }
        return sum;
    }
}
