// ==============================================================================
// Ghazali University of Technology (GUTech) LMS - Audit trail helper
// Records who changed what and when for grades and admin account actions.
// Audit failures are logged but never block the action being recorded.
// ==============================================================================

import { mockDb } from '../repositories/mockDb.js';
import { supabaseAdmin } from '../config/index.js';

export interface AuditEvent {
  actorId: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  live: boolean;
}

export interface AuditEntry {
  id: number;
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  at: string;
}

const isUuid = (value?: string) => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function recordAudit(event: AuditEvent): Promise<void> {
  const at = new Date().toISOString();
  mockDb.auditLogs.unshift({ id: Date.now() + mockDb.auditLogs.length, actorId: event.actorId, action: event.action, entity: event.entity, entityId: event.entityId, at, ...(event.metadata ? { metadata: event.metadata } : {}) } as any);
  if (mockDb.auditLogs.length > 500) mockDb.auditLogs.length = 500;
  if (!event.live) return;
  try {
    const { error } = await supabaseAdmin.from('audit_log').insert({
      actor_id: isUuid(event.actorId) ? event.actorId : null,
      action: event.action,
      entity: event.entity,
      entity_id: isUuid(event.entityId) ? event.entityId : null,
      metadata: event.metadata ?? null,
      at
    });
    if (error) console.warn('[audit] could not persist entry:', error.message);
  } catch (err) {
    console.warn('[audit] could not persist entry:', (err as Error).message);
  }
}

export async function listAudit(live: boolean, limit = 100): Promise<AuditEntry[]> {
  if (live) {
    try {
      const { data, error } = await supabaseAdmin.from('audit_log').select('*').order('at', { ascending: false }).limit(limit);
      if (!error && data) {
        const actorIds = [...new Set(data.map(row => row.actor_id).filter(Boolean))];
        const names = new Map<string, string>();
        if (actorIds.length) {
          const { data: people } = await supabaseAdmin.from('profiles').select('id, full_name').in('id', actorIds);
          (people || []).forEach(person => names.set(person.id, person.full_name));
        }
        return data.map(row => ({
          id: Number(row.id), actorId: row.actor_id, actorName: names.get(row.actor_id) || 'System', action: row.action,
          entity: row.entity, entityId: row.entity_id, metadata: row.metadata, at: row.at
        }));
      }
    } catch { /* fall through to the in-memory trail */ }
  }
  return mockDb.auditLogs.slice(0, limit).map((row: any) => ({
    id: row.id, actorId: row.actorId, actorName: mockDb.profiles.find(p => p.id === row.actorId)?.fullName || 'System',
    action: row.action, entity: row.entity, entityId: row.entityId, metadata: row.metadata ?? null, at: row.at
  }));
}
