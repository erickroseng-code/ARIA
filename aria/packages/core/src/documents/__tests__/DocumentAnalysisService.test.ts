import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentAnalysisService } from '../DocumentAnalysisService';
import { AppError } from '../../errors/AppError';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        stream: vi.fn().mockResolvedValue({
          async *[Symbol.asyncIterator]() {
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '## 📊 Resumo\n' } };
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '**Pontos-chave:**\n' } };
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '- Ponto 1\n' } };
          }
        }),
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'comercial' }]
        })
      }
    }))
  };
});

// Mock MetadataExtractor
vi.mock('../../ai/MetadataExtractor', () => {
  return {
    MetadataExtractor: {
      extractClientMetadata: vi.fn().mockResolvedValue({})
    }
  };
});

describe('DocumentAnalysisService', () => {
  let service: DocumentAnalysisService;
  let mockClaude: any;

  beforeEach(() => {
    mockClaude = {
      messages: {
        stream: vi.fn().mockResolvedValue({
          async *[Symbol.asyncIterator]() {
            yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '## Análise\n' } };
          }
        }),
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'marketing' }]
        })
      }
    };
    service = new DocumentAnalysisService(mockClaude);
  });

  describe('analyzeDocuments', () => {
    it('should stream analysis chunks from Claude', async () => {
      const doc = {
        id: 'doc1',
        originalName: 'test.pdf',
        mimeType: 'application/pdf' as const,
        extractedText: 'Test content',
        uploadedAt: new Date(),
      };

      const chunks: string[] = [];
      for await (const chunk of service.analyzeDocuments([doc], 'Test Client')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toContain('Análise');
    });

    it('should throw error when no documents provided', async () => {
      await expect(async () => {
        for await (const _ of service.analyzeDocuments([], 'Test Client')) {
          // iterate
        }
      }).rejects.toThrow(AppError);
    });

    it('should handle multiple documents', async () => {
      const docs = [
        {
          id: 'doc1',
          originalName: 'test1.pdf',
          mimeType: 'application/pdf' as const,
          extractedText: 'Content 1',
          uploadedAt: new Date(),
        },
        {
          id: 'doc2',
          originalName: 'test2.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' as const,
          extractedText: 'Content 2',
          uploadedAt: new Date(),
        },
      ];

      const chunks: string[] = [];
      for await (const chunk of service.analyzeDocuments(docs, 'Test Client')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('buildAnalysis', () => {
    it('should return complete analysis as string', async () => {
      const doc = {
        id: 'doc1',
        originalName: 'test.pdf',
        mimeType: 'application/pdf' as const,
        extractedText: 'Test content',
        uploadedAt: new Date(),
      };

      const result = await service.buildAnalysis([doc], 'Test Client');

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should throw error when no documents', async () => {
      await expect(service.buildAnalysis([], 'Test Client')).rejects.toThrow(AppError);
    });
  });

  describe('detectSectorType', () => {
    it('should detect sector type from text', async () => {
      const sector = await service.detectSectorType('Discussões sobre vendas, pipeline comercial...');

      expect(typeof sector).toBe('string');
      expect(sector.length).toBeGreaterThan(0);
    });

    it('should return lowercase result', async () => {
      const sector = await service.detectSectorType('Marketing campaign discussions');

      expect(sector).toBe(sector.toLowerCase());
    });

    it('should fallback to "geral" on missing text content', async () => {
      mockClaude.messages.create.mockResolvedValueOnce({
        content: [{ type: 'image', source: { type: 'base64', data: 'fake' } }]
      });

      const service2 = new DocumentAnalysisService(mockClaude);
      const sector = await service2.detectSectorType('Some text');

      expect(sector).toBe('geral');
    });
  });

  describe('analyzeDocumentsWithStructure (Task 7)', () => {
    it('should return GeneratedAnalysis with sections for each document', async () => {
      // Mock a realistic analysis response
      const analysisText = `
### 📊 Resumo — Comercial
**Pontos-chave:**
- Vendas em crescimento
- Pipeline saudável

---

### 📊 Resumo — Marketing
**Pontos-chave:**
- Campanha digital forte
- ROI positivo

---

## 🔗 Análise Integrada
> Complementaridade entre áreas

Sinergias identificadas:
- Comercial e Marketing alinhados

---

## ✅ Checklist de Ações Práticas

### 🔴 Alta Prioridade
- [ ] Revisar forecast comercial

### 🟡 Média Prioridade
- [ ] Otimizar campanhas

### 🟢 Baixa Prioridade
- [ ] Monitorar métricas
`;

      mockClaude.messages.stream.mockResolvedValueOnce({
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: analysisText } };
        }
      });

      const docs = [
        {
          id: 'doc1',
          originalName: 'comercial.pdf',
          mimeType: 'application/pdf' as const,
          extractedText: 'Comercial content',
          uploadedAt: new Date(),
          label: 'Setor Comercial',
        },
        {
          id: 'doc2',
          originalName: 'marketing.pdf',
          mimeType: 'application/pdf' as const,
          extractedText: 'Marketing content',
          uploadedAt: new Date(),
          label: 'Setor Marketing',
        },
      ];

      const result = await service.analyzeDocumentsWithStructure(docs, 'Test Company');

      expect(result.clientName).toBe('Test Company');
      expect(result.sections.length).toBeGreaterThanOrEqual(2);
      expect(result.sections[0].label).toBe('Setor Comercial');
      expect(result.sections[1].label).toBe('Setor Marketing');
      expect(result.sourceDocuments).toEqual(['Setor Comercial', 'Setor Marketing']);
      expect(result.integratedAnalysis.length).toBeGreaterThan(0);
      expect(result.practicalChecklist.length).toBeGreaterThan(0);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should throw error when no documents provided', async () => {
      const docs = [];

      await expect(service.analyzeDocumentsWithStructure(docs as any, 'Test Company')).rejects.toThrow(AppError);
    });

    it('should handle single document with integrated analysis', async () => {
      const analysisText = `
### 📊 Resumo — Financeiro
- Fluxo de caixa saudável

## 🔗 Análise Integrada
Análise simplificada para um único setor

## ✅ Checklist de Ações Práticas
- [ ] Revisar orçamento
`;

      mockClaude.messages.stream.mockResolvedValueOnce({
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: analysisText } };
        }
      });

      const docs = [
        {
          id: 'doc1',
          originalName: 'financeiro.pdf',
          mimeType: 'application/pdf' as const,
          extractedText: 'Financeiro content',
          uploadedAt: new Date(),
          label: 'Financeiro',
        },
      ];

      const result = await service.analyzeDocumentsWithStructure(docs, 'Test Company');

      expect(result.sections.length).toBeGreaterThanOrEqual(1);
      expect(result.sections[0].label).toBe('Financeiro');
      expect(result.sourceDocuments).toEqual(['Financeiro']);
    });

    it('should preserve document labels in sourceDocuments', async () => {
      mockClaude.messages.stream.mockResolvedValueOnce({
        async *[Symbol.asyncIterator]() {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '## Análise\n' } };
        }
      });

      const docs = [
        {
          id: 'doc1',
          originalName: 'comercial_2026.pdf',
          mimeType: 'application/pdf' as const,
          extractedText: 'Content',
          uploadedAt: new Date(),
          label: 'Setor Comercial 2026', // Custom label from user
        },
      ];

      const result = await service.analyzeDocumentsWithStructure(docs, 'Test Company');

      expect(result.sourceDocuments[0]).toBe('Setor Comercial 2026');
      expect(result.sections[0].label).toBe('Setor Comercial 2026');
    });
  });
});
