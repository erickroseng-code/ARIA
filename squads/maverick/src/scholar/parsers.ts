import fs from 'fs';
const pdf = require('pdf-parse');
import mammoth from 'mammoth';

export interface DocumentChunk {
    source: string;
    content: string;
    tags: string[]; // Keywords extraídas
}

export class DocumentParser {
    
    async parseFile(filePath: string): Promise<DocumentChunk[]> {
        const ext = filePath.split('.').pop()?.toLowerCase();
        let fullText = '';

        console.log(`📚 Scholar: Lendo arquivo ${filePath}...`);

        if (ext === 'pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            fullText = data.text;
        } else if (ext === 'docx') {
            const result = await mammoth.extractRawText({ path: filePath });
            fullText = result.value;
        } else if (ext === 'txt' || ext === 'md') {
            fullText = fs.readFileSync(filePath, 'utf-8');
        } else {
            throw new Error(`Formato não suportado: .${ext}`);
        }

        return this.chunkText(fullText, filePath);
    }

    private chunkText(text: string, source: string): DocumentChunk[] {
        // Separa por parágrafos duplos (estrutura comum de livros/artigos)
        const rawChunks = text.split(/\n\s*\n/);
        
        return rawChunks
            .map(chunk => chunk.trim())
            .filter(chunk => chunk.length > 50) // Ignora pedaços muito pequenos (títulos soltos)
            .map(chunk => ({
                source: source.split('/').pop() || source, // Apenas nome do arquivo
                content: chunk,
                tags: this.extractKeywords(chunk)
            }));
    }

    // Versão "Pobre" de extração de keywords (apenas palavras grandes)
    private extractKeywords(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove pontuação
            .split(/\s+/)
            .filter(word => word.length > 4); // Pega palavras significativas
    }
}
