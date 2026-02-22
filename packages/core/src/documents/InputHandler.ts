/**
 * InputHandler: Processa diferentes formatos de input para notas de reunião
 * Suporta: texto direto, upload de arquivo, transcrição de áudio
 */

import * as fs from 'fs';
import * as path from 'path';

export type InputFormat = 'text' | 'file' | 'audio-transcription';

export interface ProcessedInput {
  format: InputFormat;
  content: string;
  source: string; // filename, URL, or "text-paste"
  processingTime: number; // milliseconds
}

export interface FileInputOptions {
  filePath: string;
  maxSizeBytes?: number; // Default: 10MB
}

export interface AudioTranscriptionInput {
  transcriptionText: string;
  sourceFile?: string;
}

export class InputHandler {
  private maxFileSizeDefault = 10 * 1024 * 1024; // 10MB

  /**
   * Process text pasted directly from user
   */
  async processTextInput(text: string): Promise<ProcessedInput> {
    const startTime = Date.now();

    if (!text || text.trim().length === 0) {
      throw new Error('Text input cannot be empty');
    }

    if (text.length > 100000) {
      throw new Error('Text input exceeds maximum length (100KB)');
    }

    return {
      format: 'text',
      content: text.trim(),
      source: 'text-paste',
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Process file upload (PDF, DOCX, TXT)
   */
  async processFileInput(options: FileInputOptions): Promise<ProcessedInput> {
    const startTime = Date.now();
    const maxSize = options.maxSizeBytes || this.maxFileSizeDefault;

    // Validate file exists
    if (!fs.existsSync(options.filePath)) {
      throw new Error(`File not found: ${options.filePath}`);
    }

    // Check file size
    const stats = fs.statSync(options.filePath);
    if (stats.size > maxSize) {
      throw new Error(
        `File exceeds maximum size (${maxSize / 1024 / 1024}MB): ${stats.size / 1024 / 1024}MB`
      );
    }

    // Check file extension
    const ext = path.extname(options.filePath).toLowerCase();
    const supportedFormats = ['.txt', '.pdf', '.docx', '.doc'];
    if (!supportedFormats.includes(ext)) {
      throw new Error(
        `Unsupported file format: ${ext}. Supported: ${supportedFormats.join(', ')}`
      );
    }

    // Parse file content
    const content = await this.parseFileContent(options.filePath);

    return {
      format: 'file',
      content,
      source: path.basename(options.filePath),
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Process audio transcription from Story 3.1
   */
  async processAudioTranscription(input: AudioTranscriptionInput): Promise<ProcessedInput> {
    const startTime = Date.now();

    if (!input.transcriptionText || input.transcriptionText.trim().length === 0) {
      throw new Error('Transcription text cannot be empty');
    }

    if (input.transcriptionText.length > 100000) {
      throw new Error('Transcription text exceeds maximum length (100KB)');
    }

    return {
      format: 'audio-transcription',
      content: input.transcriptionText.trim(),
      source: input.sourceFile || 'audio-transcription',
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Parse file content based on extension
   */
  private async parseFileContent(filePath: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
      case '.txt':
        return this.parsePlainText(filePath);
      case '.pdf':
        return this.parsePdf(filePath);
      case '.docx':
      case '.doc':
        return this.parseWord(filePath);
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }

  /**
   * Parse plain text file
   */
  private parsePlainText(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.trim();
  }

  /**
   * Parse PDF file (simplified - would need pdf-parse library)
   * For now, returns placeholder
   */
  private async parsePdf(filePath: string): Promise<string> {
    // Note: In production, would use 'pdf-parse' library
    // For now, return a simplified version
    const fs_module = await import('fs');
    const buffer = fs_module.readFileSync(filePath);

    // Simple approach: try to extract text from buffer
    // In production: use pdf-parse library
    const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 10000));

    // Filter out non-printable characters
    return text
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .split('\n')
      .filter(line => line.trim().length > 0)
      .join('\n')
      .substring(0, 50000); // Limit to 50KB of text
  }

  /**
   * Parse Word document (simplified - would need docx library)
   * For now, returns placeholder
   */
  private async parseWord(filePath: string): Promise<string> {
    // Note: In production, would use 'docx' or 'mammoth' library
    // For now, return a placeholder message
    // This is a limitation of the MVP - real implementation would parse .docx properly

    const fileName = path.basename(filePath);
    return `[Arquivo DOCX: ${fileName} - parsing requer biblioteca de terceiros (mammoth/docx)]`;
  }

  /**
   * Validate and clean meeting notes
   */
  validateAndCleanNotes(notes: string): { valid: boolean; cleaned: string; error?: string } {
    if (!notes || notes.trim().length === 0) {
      return { valid: false, cleaned: '', error: 'Notes cannot be empty' };
    }

    // Clean up whitespace
    const cleaned = notes
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    if (cleaned.length === 0) {
      return { valid: false, cleaned: '', error: 'Notes contain only whitespace' };
    }

    if (cleaned.length > 100000) {
      return { valid: false, cleaned: '', error: 'Notes exceed maximum length (100KB)' };
    }

    return { valid: true, cleaned };
  }

  /**
   * Detect format from content characteristics
   */
  detectFormat(content: string): InputFormat {
    // Simple heuristics
    if (content.includes('[Arquivo')) {
      return 'file';
    }

    if (content.includes('Timestamp:') || content.includes('Speaker:')) {
      return 'audio-transcription';
    }

    return 'text';
  }
}
