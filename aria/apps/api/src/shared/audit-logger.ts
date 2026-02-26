/**
 * Story 6.4 — Task 8: Audit Logging & Monitoring
 * Audit logger for sensitive operations.
 */

import { FastifyRequest } from 'fastify';

export type AuditAction =
    | 'auth.login'
    | 'auth.logout'
    | 'auth.refresh'
    | 'auth.login_failed'
    | 'document.upload'
    | 'document.analyze'
    | 'report.generate'
    | 'report.create_schedule'
    | 'report.delete_schedule'
    | 'settings.update';

export interface AuditEntry {
    id: string;
    timestamp: Date;
    action: AuditAction;
    userId: string;
    ip: string;
    userAgent: string;
    details?: Record<string, unknown>;
    success: boolean;
}

// In-memory store (replace with DB/CloudWatch in production)
const auditLog: AuditEntry[] = [];

export function logAuditEvent(
    action: AuditAction,
    req: FastifyRequest,
    details?: Record<string, unknown>,
    success: boolean = true
): AuditEntry {
    const entry: AuditEntry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: new Date(),
        action,
        userId: (req as any).user?.userId || 'anonymous',
        ip: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        details,
        success,
    };

    auditLog.push(entry);

    // Keep only last 10000 entries in memory
    if (auditLog.length > 10000) {
        auditLog.splice(0, auditLog.length - 10000);
    }

    console.log(`[AUDIT] ${success ? '✅' : '❌'} ${action} by ${entry.userId} from ${entry.ip}`);

    return entry;
}

export function getAuditLog(filters?: {
    userId?: string;
    action?: AuditAction;
    limit?: number;
}): AuditEntry[] {
    let results = [...auditLog];

    if (filters?.userId) {
        results = results.filter((e) => e.userId === filters.userId);
    }
    if (filters?.action) {
        results = results.filter((e) => e.action === filters.action);
    }

    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return results.slice(0, filters?.limit || 100);
}
