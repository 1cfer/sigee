import { deriveAlerts } from './selectors';
import type { DatabaseV2, AlertHistory } from './v2';
export function reconcileAlerts(db: DatabaseV2, at = new Date().toISOString()): void {
  const active = deriveAlerts(db);
  const conditions = new Map(active.map((a) => [a.id, a]));
  for (const old of db.alertHistory) {
    if (!conditions.has(old.id) && old.status !== 'resuelta') {
      old.status = 'resuelta';
      old.resolvedAt = at;
      db.events.push({
        id: crypto.randomUUID(),
        entityType: 'alert',
        entityId: old.id,
        action: 'resolución',
        at,
        actor: 'Reglas automáticas',
        description: 'La condición de seguimiento dejó de cumplirse.',
      });
    }
  }
  for (const alert of active) {
    const old = db.alertHistory.find((a) => a.id === alert.id);
    if (!old || old.status === 'resuelta') {
      const record: AlertHistory = {
        ...alert,
        generatedAt: at,
        status: 'activa',
        action: 'Consultar el registro y coordinar su seguimiento administrativo.',
      };
      if (old) Object.assign(old, record, { resolvedAt: undefined, acknowledgedAt: undefined });
      else db.alertHistory.push(record);
      db.events.push({
        id: crypto.randomUUID(),
        entityType: 'alert',
        entityId: alert.id,
        action: old ? 'reactivación' : 'generación',
        at,
        actor: 'Reglas automáticas',
        description: alert.title,
      });
    } else Object.assign(old, alert);
  }
}
