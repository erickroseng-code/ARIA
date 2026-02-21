import mammoth from 'mammoth';
import { randomUUID } from 'crypto';
import type { ProcessedDocument, SupportedMimeType } from '@aria/shared';
import { AppError } from '../errors/AppError';

export class DocxParser {
  async parse(buffer: Buffer, filename: string, mimeType: SupportedMimeType): Promise<ProcessedDocument> {
    try {
      const result = await mammoth.extractRawText({ buffer });

      return {
        id: randomUUID(),
        originalName: filename,
        mimeType,
        extractedText: result.value.trim(),
        uploadedAt: new Date(),
        processedAt: new Date(),
      };
    } catch (error) {
      throw new AppError(
        `Failed to parse document: ${filename}`,
        'DOC_003',
        { statusCode: 422, cause: error }
      );
    }
  }
}
