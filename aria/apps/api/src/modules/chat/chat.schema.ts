import { z } from 'zod';

export const ChatMessageBodySchema = z.object({
  content: z.string().min(1, 'Content is required'),
  sessionId: z.string().min(1, 'sessionId is required'),
});

export const ChatStreamBodySchema = z.object({
  content: z.string().min(1, 'Content is required'),
  sessionId: z.string().min(1, 'sessionId is required'),
});

export type ChatMessageBody = z.infer<typeof ChatMessageBodySchema>;
export type ChatStreamBody = z.infer<typeof ChatStreamBodySchema>;
