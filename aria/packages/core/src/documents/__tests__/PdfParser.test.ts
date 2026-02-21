import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfParser } from '../PdfParser';

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  default: vi.fn(async (buffer: Buffer) => {
    if (buffer.toString().includes('invalid')) {
      throw new Error('Corrupted PDF');
    }
    return {
      text: 'Extracted PDF text content',
      numpages: 5,
      info: { version: '1.4' },
    };
  }),
}));

describe('PdfParser', () => {
  let parser: PdfParser;

  beforeEach(() => {
    parser = new PdfParser();
  });

  it('should parse valid PDF buffer', async () => {
    const buffer = Buffer.from('valid pdf content');
    const result = await parser.parse(buffer, 'test.pdf');

    expect(result.originalName).toBe('test.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.extractedText).toContain('Extracted PDF text');
    expect(result.id).toBeDefined();
    expect(result.uploadedAt).toBeInstanceOf(Date);
    expect(result.processedAt).toBeInstanceOf(Date);
  });

  it('should handle corrupted PDF gracefully', async () => {
    const buffer = Buffer.from('invalid pdf');

    await expect(parser.parse(buffer, 'corrupt.pdf')).rejects.toThrow('Failed to parse PDF');
  });

  it('should trim extracted text', async () => {
    const buffer = Buffer.from('valid pdf');
    const result = await parser.parse(buffer, 'test.pdf');

    expect(result.extractedText).toBe('Extracted PDF text content');
  });
});
