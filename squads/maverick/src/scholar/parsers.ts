import * as fs from 'fs';
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

export interface DocumentChunk {
    source: string;
    content: string;
    tags: string[]; // Keywords extraídas
}

export class DocumentParser {
    
    async parseFile(filePath: string): Promise<DocumentChunk[]> {
        const ext = filePath.split('.').pop()?.toLowerCase();
        let fullText = '';


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
        const filename = source.split(/[/\\]/).pop() || source;
        const targetSize = 800;  // chars per chunk — enough context, fits in embedding well
        const overlap = 150;     // chars carried over to next chunk to avoid losing context at boundaries

        // Split into paragraphs, clean noise typical of PDF extraction
        const paragraphs = text
            .split(/\n\s*\n/)
            .map(p => p.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim())
            .filter(p => p.length > 40); // drop page numbers, isolated headers, artifacts

        const chunks: DocumentChunk[] = [];
        let current = '';

        for (const para of paragraphs) {
            if (current.length + para.length + 1 > targetSize && current.length > 0) {
                chunks.push({
                    source: filename,
                    content: current.trim(),
                    tags: this.extractKeywords(current),
                });
                // Carry overlap from end of current chunk into next
                current = current.slice(-overlap) + ' ' + para;
            } else {
                current = current ? current + ' ' + para : para;
            }
        }

        if (current.trim().length > 40) {
            chunks.push({
                source: filename,
                content: current.trim(),
                tags: this.extractKeywords(current),
            });
        }

        return chunks;
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
