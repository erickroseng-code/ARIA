import { randomUUID } from 'crypto';
import type { ProcessedDocument } from '@aria/shared';
import { AppError } from '../errors/AppError';

// Import pdf-parse with proper typing
import pdfParseModule from 'pdf-parse';

export class PdfParser {
  async parse(buffer: Buffer, filename: string): Promise<ProcessedDocument> {
    try {
      // pdf-parse is a function that takes a buffer
      const result = await (pdfParseModule as unknown as (buffer: Buffer) => Promise<{ text: string; numpages: number; info: unknown }>)(buffer);

      return {
        id: randomUUID(),
        originalName: filename,
        mimeType: 'application/pdf',
        extractedText: result.text.trim(),
        uploadedAt: new Date(),
        processedAt: new Date(),
      };
    } catch (error) {
      throw new AppError(
        `Failed to parse PDF: ${filename}`,
        'DOC_003',
        { statusCode: 422, cause: error }
      );
    }
  }
}
