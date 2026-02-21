import { Router, Request, Response } from 'express';
import multer from 'multer';
import { AudioService } from '@aria/core';
import { env } from '../config/env';

const router = Router();
const audioService = new AudioService(env.OPENAI_API_KEY);
const upload = multer({ storage: multer.memoryStorage() });

const MAX_AUDIO_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FORMATS = ['wav', 'mp3', 'ogg', 'm4a', 'webm'];

/**
 * POST /api/audio/transcribe
 * Transcribe audio file using Whisper API
 *
 * Request:
 * - audio: File (multipart/form-data)
 * - format: string (optional, default: 'wav')
 *
 * Response:
 * {
 *   text: string,
 *   duration?: number
 * }
 */
router.post('/transcribe', upload.single('audio'), async (req: any, res: Response) => {
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const format = (req.body.format || 'wav').toLowerCase();

    // Validate format
    if (!ALLOWED_FORMATS.includes(format)) {
      return res.status(400).json({
        error: `Unsupported format: ${format}. Supported: ${ALLOWED_FORMATS.join(', ')}`,
      });
    }

    // Validate file size
    if (req.file.size > MAX_AUDIO_SIZE) {
      const sizeMb = (req.file.size / (1024 * 1024)).toFixed(1);
      return res.status(400).json({
        error: `File too large (${sizeMb}MB). Maximum: 10MB.`,
      });
    }

    // Transcribe audio
    const buffer = req.file.buffer;
    const transcription = await audioService.transcribeFromBuffer(buffer, {
      format: format as 'wav' | 'mp3' | 'ogg' | 'm4a',
      language: 'pt',
      maxRetries: 2,
    });

    // Validate transcription result
    if (!transcription || transcription.trim().length === 0) {
      return res.status(422).json({
        error: 'No speech detected in audio. Please try again with clearer audio.',
      });
    }

    res.json({
      text: transcription,
      duration: Math.round((req.file.size / 172000) * 100) / 100, // Rough estimate
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Transcription error:', errorMsg);

    // Handle rate limiting
    if (errorMsg.includes('rate_limit')) {
      return res.status(429).json({
        error: 'Too many transcription requests. Please try again in a moment.',
      });
    }

    // Handle timeout
    if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
      return res.status(504).json({
        error: 'Transcription took too long. Please try with a shorter audio.',
      });
    }

    res.status(500).json({
      error: `Transcription failed: ${errorMsg}`,
    });
  }
});

export default router;
