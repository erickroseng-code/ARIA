import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocxParser } from '../DocxParser';

// Mock mammoth
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn(async (options: { buffer: Buffer }) => {
      if (options.buffer.toString().includes('invalid')) {
        throw new Error('Corrupted DOCX');
      }
      return {
        value: 'Extracted DOCX text content',
      };
    }),
  },
}));

describe('DocxParser', () => {
  let parser: DocxParser;

  beforeEach(() => {
    parser = new DocxParser();
  });

  it('should parse valid DOCX buffer', async () => {
    const buffer = Buffer.from('valid docx content');
    const result = await parser.parse(
      buffer,
      'test.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    expect(result.originalName).toBe('test.docx');
    expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(result.extractedText).toContain('Extracted DOCX text');
    expect(result.id).toBeDefined();
    expect(result.uploadedAt).toBeInstanceOf(Date);
    expect(result.processedAt).toBeInstanceOf(Date);
  });

  it('should handle corrupted DOCX gracefully', async () => {
    const buffer = Buffer.from('invalid docx');

    await expect(
      parser.parse(buffer, 'corrupt.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    ).rejects.toThrow('Failed to parse document');
  });

  it('should support .doc format', async () => {
    const buffer = Buffer.from('valid doc content');
    const result = await parser.parse(buffer, 'test.doc', 'application/msword');

    expect(result.mimeType).toBe('application/msword');
    expect(result.extractedText).toBeDefined();
  });

  it('should trim extracted text', async () => {
    const buffer = Buffer.from('valid docx');
    const result = await parser.parse(
      buffer,
      'test.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );

    expect(result.extractedText).toBe('Extracted DOCX text content');
  });
});
