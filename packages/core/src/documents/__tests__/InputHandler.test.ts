import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputHandler } from '../InputHandler';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('fs');

describe('InputHandler', () => {
  let handler: InputHandler;

  beforeEach(() => {
    handler = new InputHandler();
    vi.clearAllMocks();
  });

  describe('Text input processing', () => {
    it('should process valid text input', async () => {
      const text = 'These are meeting notes for the discussion';

      const result = await handler.processTextInput(text);

      expect(result.format).toBe('text');
      expect(result.content).toBe(text);
      expect(result.source).toBe('text-paste');
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should reject empty text', async () => {
      await expect(handler.processTextInput('')).rejects.toThrow('empty');
    });

    it('should reject oversized text', async () => {
      const oversized = 'a'.repeat(100001);

      await expect(handler.processTextInput(oversized)).rejects.toThrow('exceed');
    });

    it('should trim whitespace', async () => {
      const text = '  Some text with spaces  ';

      const result = await handler.processTextInput(text);

      expect(result.content).toBe('Some text with spaces');
    });
  });

  describe('File input processing', () => {
    it('should process valid text file', async () => {
      const filePath = '/tmp/meeting-notes.txt';

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ size: 1000 } as any);
      vi.mocked(fs.readFileSync).mockReturnValue('File content' as any);

      const result = await handler.processFileInput({ filePath });

      expect(result.format).toBe('file');
      expect(result.source).toBe('meeting-notes.txt');
    });

    it('should reject non-existent file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        handler.processFileInput({ filePath: '/tmp/missing.txt' })
      ).rejects.toThrow('not found');
    });

    it('should reject oversized file', async () => {
      const filePath = '/tmp/large.txt';

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ size: 15 * 1024 * 1024 } as any);

      await expect(handler.processFileInput({ filePath })).rejects.toThrow('exceed');
    });

    it('should reject unsupported file formats', async () => {
      const filePath = '/tmp/meeting.exe';

      vi.mocked(fs.existsSync).mockReturnValue(true);

      await expect(handler.processFileInput({ filePath })).rejects.toThrow(
        'Unsupported'
      );
    });

    it('should support TXT, PDF, DOCX formats', async () => {
      const supportedFiles = ['notes.txt', 'transcript.pdf', 'doc.docx'];

      for (const file of supportedFiles) {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.statSync).mockReturnValue({ size: 1000 } as any);
        vi.mocked(fs.readFileSync).mockReturnValue('Content' as any);

        const result = await handler.processFileInput({
          filePath: `/tmp/${file}`,
        });

        expect(result.format).toBe('file');
        expect(result.source).toBe(file);
      }
    });

    it('should allow custom max file size', async () => {
      const filePath = '/tmp/notes.txt';
      const customMaxSize = 5 * 1024 * 1024; // 5MB

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ size: 4 * 1024 * 1024 } as any);
      vi.mocked(fs.readFileSync).mockReturnValue('Content' as any);

      const result = await handler.processFileInput({
        filePath,
        maxSizeBytes: customMaxSize,
      });

      expect(result.format).toBe('file');
    });
  });

  describe('Audio transcription input', () => {
    it('should process audio transcription', async () => {
      const transcription = 'Transcript from audio file';

      const result = await handler.processAudioTranscription({
        transcriptionText: transcription,
        sourceFile: 'recording.mp3',
      });

      expect(result.format).toBe('audio-transcription');
      expect(result.content).toBe(transcription);
      expect(result.source).toBe('recording.mp3');
    });

    it('should reject empty transcription', async () => {
      await expect(
        handler.processAudioTranscription({
          transcriptionText: '',
        })
      ).rejects.toThrow('empty');
    });

    it('should reject oversized transcription', async () => {
      const oversized = 'a'.repeat(100001);

      await expect(
        handler.processAudioTranscription({
          transcriptionText: oversized,
        })
      ).rejects.toThrow('exceed');
    });

    it('should use default source if not provided', async () => {
      const result = await handler.processAudioTranscription({
        transcriptionText: 'Transcript',
      });

      expect(result.source).toBe('audio-transcription');
    });
  });

  describe('Validation and cleanup', () => {
    it('should validate and clean valid notes', () => {
      const notes = '  Line 1  \n  Line 2  \n  Line 3  ';

      const result = handler.validateAndCleanNotes(notes);

      expect(result.valid).toBe(true);
      expect(result.cleaned).toContain('Line 1');
      expect(result.cleaned).not.toContain('  ');
    });

    it('should reject empty notes', () => {
      const result = handler.validateAndCleanNotes('');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject whitespace-only notes', () => {
      const result = handler.validateAndCleanNotes('   \n\n   ');

      expect(result.valid).toBe(false);
    });

    it('should reject oversized notes', () => {
      const oversized = 'a'.repeat(100001);

      const result = handler.validateAndCleanNotes(oversized);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceed');
    });

    it('should remove empty lines', () => {
      const notes = 'Line 1\n\n\nLine 2\n\nLine 3';

      const result = handler.validateAndCleanNotes(notes);

      expect(result.cleaned.split('\n').length).toBeLessThan(notes.split('\n').length);
    });
  });

  describe('Format detection', () => {
    it('should detect text format', () => {
      const format = handler.detectFormat('Plain text content');

      expect(format).toBe('text');
    });

    it('should detect file format', () => {
      const format = handler.detectFormat('[Arquivo meeting-notes.pdf - parsing...]');

      expect(format).toBe('file');
    });

    it('should detect audio transcription format', () => {
      const format = handler.detectFormat('Timestamp: 00:00 Speaker: John: Hello');

      expect(format).toBe('audio-transcription');
    });
  });

  describe('Error handling', () => {
    it('should handle file read errors gracefully', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ size: 1000 } as any);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      await expect(
        handler.processFileInput({ filePath: '/tmp/error.txt' })
      ).rejects.toThrow();
    });

    it('should provide descriptive error messages', async () => {
      const result = handler.validateAndCleanNotes('');

      expect(result.error).toBeDefined();
      expect(result.error?.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should process text quickly', async () => {
      const text = 'Meeting notes content';
      const startTime = Date.now();

      await handler.processTextInput(text);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(100); // Should be nearly instant
    });

    it('should handle whitespace removal efficiently', () => {
      const notes = 'Line 1\n'.repeat(1000);

      const result = handler.validateAndCleanNotes(notes);

      expect(result.valid).toBe(true);
      expect(result.processingTime || 0).toBeLessThan(500);
    });
  });
});
