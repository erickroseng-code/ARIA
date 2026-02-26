/**
 * Story 6.4 — Task 4: Input Validation & Sanitization
 * Zod schemas for all user-facing endpoints.
 */

import { z } from 'zod';

/** Auth schemas */
export const loginSchema = z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
});

/** Chat schemas */
export const chatMessageSchema = z.object({
    message: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long (max 5000 chars)'),
    sessionId: z.string().optional(),
    clientName: z.string().max(100).optional(),
});

/** Document schemas */
export const analyzeDocumentsSchema = z.object({
    sessionId: z.string().optional(),
    clientName: z.string().max(100).optional(),
    userId: z.string().optional(),
});

/** Scheduled report schemas */
export const createScheduledReportSchema = z.object({
    name: z.string().min(1).max(200),
    cronExpression: z.string().min(1),
    userId: z.string().min(1),
    channels: z.array(z.enum(['email', 'telegram', 'notion'])).min(1),
    reportConfig: z.record(z.string(), z.unknown()).optional(),
});

export const updateScheduledReportSchema = createScheduledReportSchema.partial();

/** Calendar schemas */
export const createEventSchema = z.object({
    title: z.string().min(1).max(500),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    timezone: z.string().min(1),
    description: z.string().max(2000).optional(),
});

export const queryEventsSchema = z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
});

/** Pagination schema */
export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});
