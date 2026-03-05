// Google AI Embedding Service — REST API v1 (bypasses SDK v1beta limitation)
// Uses text-embedding-004 (768 dims, multilingual, excellent quality)
// Free tier: 1500 RPM — no rate limit issues for indexing

export class EmbeddingService {
    private readonly apiKey: string;
    private readonly model = 'gemini-embedding-001';
    private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    private readonly batchSize = 50;
    readonly dimensions = 768;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async embedPassages(texts: string[]): Promise<Float32Array[]> {
        return this.embedBatched(texts, 'RETRIEVAL_DOCUMENT');
    }

    async embedQuery(text: string): Promise<Float32Array> {
        const results = await this.embedBatched([text], 'RETRIEVAL_QUERY');
        return results[0];
    }

    private async embedBatched(texts: string[], taskType: string): Promise<Float32Array[]> {
        const results: Float32Array[] = [];
        const totalBatches = Math.ceil(texts.length / this.batchSize);

        for (let i = 0; i < texts.length; i += this.batchSize) {
            const batch = texts.slice(i, i + this.batchSize);
            const batchNum = Math.floor(i / this.batchSize) + 1;

            const vectors = await this.callBatchAPI(batch, taskType);
            results.push(...vectors);
        }
        return results;
    }

    private async callBatchAPI(texts: string[], taskType: string): Promise<Float32Array[]> {
        const url = `${this.baseUrl}/${this.model}:batchEmbedContents?key=${this.apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: texts.map(text => ({
                    model: `models/${this.model}`,
                    content: { parts: [{ text }] },
                    taskType,
                })),
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Google AI error (${response.status}): ${error}`);
        }

        const data = await response.json() as { embeddings: { values: number[] }[] };
        return data.embeddings.map(e => this.normalize(new Float32Array(e.values)));
    }

    private normalize(vec: Float32Array): Float32Array {
        let norm = 0;
        for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
        norm = Math.sqrt(norm);
        if (norm === 0) return vec;
        const out = new Float32Array(vec.length);
        for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
        return out;
    }
}
