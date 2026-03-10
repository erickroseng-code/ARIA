import { db } from '../../../config/db';

export interface AuditEntry {
  action: string;
  entityType: 'campaign' | 'adset' | 'ad' | 'unknown';
  entityId: string;
  workspaceId: string;
  dryRun: boolean;
  result: string;
  reason?: string;
  triggeredBy?: 'scheduler' | 'chat';
}

export function logAtlasAction(entry: AuditEntry): void {
  try {
    db.prepare(`
      INSERT INTO atlas_audit_log
        (action, entity_type, entity_id, workspace_id, dry_run, result, reason, triggered_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.workspaceId,
      entry.dryRun ? 1 : 0,
      entry.result,
      entry.reason ?? null,
      entry.triggeredBy ?? 'scheduler'
    );
  } catch (err) {
    console.error('[Atlas Audit] Failed to log action:', err);
  }
}

export function getAuditLogs(workspaceId?: string, limit = 50): AuditEntry[] {
  const safeLimit = Math.min(Number(limit), 200);
  try {
    if (workspaceId) {
      return db.prepare(
        'SELECT * FROM atlas_audit_log WHERE workspace_id = ? ORDER BY id DESC LIMIT ?'
      ).all(workspaceId, safeLimit) as unknown as AuditEntry[];
    }
    return db.prepare(
      'SELECT * FROM atlas_audit_log ORDER BY id DESC LIMIT ?'
    ).all(safeLimit) as unknown as AuditEntry[];
  } catch (err) {
    console.error('[Atlas Audit] Failed to query logs:', err);
    return [];
  }
}
