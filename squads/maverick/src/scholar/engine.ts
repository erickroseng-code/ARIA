import { DocumentParser, DocumentChunk } from './parsers';
import * as fs from 'fs';
import * as path from 'path';

// TODO: Upgrade to Vector Embeddings (OpenAI/Pinecone) for real semantic search
export class ScholarEngine {
    private chunks: DocumentChunk[] = [];
    private parser: DocumentParser;
    private knowledgeDir: string;

    constructor() {
        this.parser = new DocumentParser();
        this.knowledgeDir = path.resolve(__dirname, '../../data/knowledge');
        
        // Ensure dir exists
        if (!fs.existsSync(this.knowledgeDir)) {
            fs.mkdirSync(this.knowledgeDir, { recursive: true });
        }
    }

    // Carrega TODOS os arquivos da pasta data/knowledge
    async loadKnowledgeBase() {
        console.log("📚 Scholar: Carregando Base de Conhecimento...");
        const files = fs.readdirSync(this.knowledgeDir);
        
        this.chunks = []; // Reset
        for (const file of files) {
            try {
                const filePath = path.join(this.knowledgeDir, file);
                
                // Skip directories
                if (fs.statSync(filePath).isDirectory()) continue;

                const fileChunks = await this.parser.parseFile(filePath);
                this.chunks.push(...fileChunks);
            } catch (e) {
                console.warn(`⚠️ Erro ao ler ${file}:`, e);
            }
        }
        console.log(`✅ Base Carregada: ${this.chunks.length} fragmentos de conhecimento disponíveis.`);
    }

    // A "Busca Semântica" Simplificada
    search(query: string, limit: number = 3): DocumentChunk[] {
        const queryKeywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        
        const scoredChunks = this.chunks.map(chunk => {
            let score = 0;
            // Pontua +1 para cada palavra da query que existe no chunk
            queryKeywords.forEach(q => {
                if (chunk.content.toLowerCase().includes(q)) {
                    score += 1;
                }
            });
            return { chunk, score };
        });

        // Ordena por maior score e pega os top X
        return scoredChunks
            .sort((a, b) => b.score - a.score)
            .filter(item => item.score > 0) // Remove irrelevantes
            .slice(0, limit)
            .map(item => item.chunk);
    }
}
