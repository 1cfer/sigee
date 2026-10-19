export {
  dateSchema,
  findingSchema,
  ppeSchema,
  studySchema,
  documentSchema,
  validateInventory,
} from './legacy-validation';
import { assertIntegrity as assertLegacy } from './legacy-validation';
import { z } from 'zod';
import type { DatabaseV2 } from './v2';
import { UNAVAILABLE_REASONS } from './v2';
const stamp = z.iso.datetime();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const common = z.object({
  id: z.string().min(1),
  createdAt: stamp,
  updatedAt: stamp,
  provenance: z.enum(['demostración', 'sesión', 'migrado']),
  archived: z.boolean().optional(),
});
const kind = z.enum(['installation', 'asset', 'finding', 'ppe', 'study', 'document', 'alert']);
const recordText = z.string().max(3000);
const documentState = z.enum([
  'borrador',
  'en revisión',
  'aprobado administrativamente',
  'archivado',
]);
const v2Shape = z.object({
  schemaVersion: z.literal(2),
  revision: z.number().int().nonnegative().optional(),
  installations: z.array(
    common.extend({
      code: z.string().min(1),
      description: recordText,
      responsible: z.string().min(1),
    }),
  ),
  assets: z.array(
    common.extend({
      description: recordText,
      responsible: z.string().min(1),
      operationalStatus: z.enum([
        'sin verificar',
        'registrado en servicio',
        'registrado fuera de servicio',
        'retirado',
      ]),
    }),
  ),
  findings: z.array(
    common.extend({
      correctiveAction: recordText,
      closureJustification: recordText,
      closedBy: z.string().optional(),
    }),
  ),
  ppe: z.array(
    common.extend({
      category: z.string(),
      manufacturer: z.string(),
      description: recordText,
      location: z.string(),
      lastInspection: date.optional(),
    }),
  ),
  assignments: z.array(
    z.object({
      id: z.string(),
      responsible: z.string().min(1),
      activity: recordText,
      notes: recordText,
      expectedReturn: z.union([date, z.literal('')]).optional(),
      returnedAt: stamp.optional(),
    }),
  ),
  studies: z.array(
    common.extend({
      title: z.string().min(1),
      objective: recordText,
      scope: recordText,
      observations: recordText,
      originalDate: date,
      documentState,
      uploadedAt: stamp.optional(),
      lastReviewedAt: date.optional(),
      technical: z.object({
        nominalVoltage: recordText,
        shortCircuitCurrent: recordText,
        workingDistance: recordText,
        incidentEnergy: recordText,
        arcBoundary: recordText,
        methodology: recordText,
        assumptions: recordText,
        conclusions: recordText,
      }),
    }),
  ),
  documents: z.array(
    common.extend({
      description: recordText,
      originalDate: date,
      documentState,
      uploadedAt: stamp.optional(),
      lastReviewedAt: date.optional(),
    }),
  ),
  events: z.array(
    z.object({
      id: z.string(),
      entityType: kind,
      entityId: z.string(),
      action: z.string().min(1),
      at: stamp,
      actor: z.string().min(1),
      description: recordText,
      before: z.record(z.string(), z.unknown()).optional(),
      after: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
  movements: z.array(
    z.object({
      id: z.string(),
      ppeId: z.string(),
      type: z.enum([
        'saldo inicial',
        'entrada',
        'asignación',
        'devolución',
        'inspección',
        'cambio de estado',
        'corrección',
        'baja',
      ]),
      at: stamp,
      quantity: z.number().int().positive(),
      availableDelta: z.number().int(),
      assignedDelta: z.number().int(),
      unavailableDelta: z.partialRecord(z.enum(UNAVAILABLE_REASONS), z.number().int()),
      responsible: z.string().min(1),
      source: z.string(),
      notes: recordText,
    }),
  ),
  attachments: z.array(
    z.object({
      id: z.string(),
      entityType: z.enum(['study', 'document', 'finding', 'ppe']),
      entityId: z.string(),
      name: z.string().min(1),
      mime: z.enum(['application/pdf', 'image/png', 'image/jpeg']),
      size: z.number().int().positive(),
      uploadedAt: stamp,
      version: z.string().min(1),
      notes: recordText,
    }),
  ),
  versions: z.array(
    z.object({
      id: z.string(),
      entityType: z.enum(['study', 'document']),
      entityId: z.string(),
      attachmentId: z.string(),
      version: z.string().min(1),
      at: stamp,
      notes: recordText,
    }),
  ),
  reviews: z.array(
    z.object({
      id: z.string(),
      entityType: z.enum(['study', 'document']),
      entityId: z.string(),
      at: stamp,
      responsible: z.string().min(1),
      notes: recordText,
      nextReview: z.union([date, z.literal('')]),
      version: z.string().min(1),
    }),
  ),
  alertHistory: z.array(
    z.object({
      id: z.string(),
      sourceType: z.enum(['hallazgo', 'epp', 'estudio', 'documento']),
      sourceId: z.string(),
      severity: z.enum(['prioritaria', 'atención']),
      title: z.string(),
      description: recordText,
      relevantDate: z.union([date, z.literal('')]),
      path: z.string(),
      generatedAt: stamp,
      status: z.enum(['activa', 'reconocida', 'resuelta']),
      acknowledgedAt: stamp.optional(),
      resolvedAt: stamp.optional(),
      action: z.string(),
    }),
  ),
});
export function assertIntegrity(db: DatabaseV2): void {
  v2Shape.parse(db);
  assertLegacy({ ...db, assignments: db.assignments.filter((a) => !a.returnedAt) });
  if (db.schemaVersion !== 2) throw new Error('Versión de datos incompatible.');
  const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));
  const entities = {
    installation: ids(db.installations),
    asset: ids(db.assets),
    finding: ids(db.findings),
    ppe: ids(db.ppe),
    study: ids(db.studies),
    document: ids(db.documents),
    alert: ids(db.alertHistory),
  };
  for (const codes of [
    db.installations.map((r) => r.code),
    db.assets.map((r) => r.code),
    db.ppe.map((r) => r.code),
    db.documents.map((r) => r.code),
    db.studies.map((r) => r.reference),
  ])
    if (new Set(codes).size !== codes.length) throw new Error('Existen códigos duplicados.');
  for (const list of [
    db.events,
    db.movements,
    db.attachments,
    db.versions,
    db.reviews,
    db.alertHistory,
  ])
    if (!Array.isArray(list) || ids(list).size !== list.length)
      throw new Error('Historial o identificadores inválidos.');
  for (const ppe of db.ppe) {
    const moves = db.movements.filter((m) => m.ppeId === ppe.id);
    let runningAvailable = 0,
      runningAssigned = 0;
    const runningReasons = Object.fromEntries(UNAVAILABLE_REASONS.map((reason) => [reason, 0]));
    for (const m of moves) {
      runningAvailable += m.availableDelta;
      runningAssigned += m.assignedDelta;
      for (const reason of UNAVAILABLE_REASONS)
        runningReasons[reason] = (runningReasons[reason] ?? 0) + (m.unavailableDelta[reason] ?? 0);
      if ([runningAvailable, runningAssigned, ...Object.values(runningReasons)].some((n) => n < 0))
        throw new Error('Un movimiento produciría inventario negativo.');
    }
    const available = moves.reduce((s, m) => s + m.availableDelta, 0),
      assigned = moves.reduce((s, m) => s + m.assignedDelta, 0);
    const reasons = Object.fromEntries(
      UNAVAILABLE_REASONS.map((reason) => [
        reason,
        moves.reduce((s, m) => s + (m.unavailableDelta[reason] ?? 0), 0),
      ]),
    );
    const unavailable = Object.values(reasons).reduce((s, n) => s + n, 0);
    if (
      ![available, assigned, ...Object.values(reasons)].every(
        (n) => Number.isInteger(n) && n >= 0,
      ) ||
      ppe.available !== available ||
      ppe.unavailable !== unavailable ||
      ppe.total !== available + assigned + unavailable
    )
      throw new Error('Los movimientos no coinciden con los saldos del inventario.');
    if (ppe.installationId && !entities.installation.has(ppe.installationId))
      throw new Error('Instalación EPP inexistente.');
  }
  for (const m of db.movements) {
    if (
      !entities.ppe.has(m.ppeId) ||
      !Number.isInteger(m.quantity) ||
      m.quantity <= 0 ||
      !m.responsible.trim()
    )
      throw new Error('Movimiento de inventario inválido.');
    z.iso.datetime().parse(m.at);
  }
  for (const event of db.events)
    if (!entities[event.entityType].has(event.entityId))
      throw new Error('El historial contiene una relación inexistente.');
  for (const assignment of db.assignments)
    if (assignment.returnedAt && assignment.returnedAt < assignment.assignedAt)
      throw new Error('La devolución no puede preceder a la asignación.');
  for (const f of db.findings)
    if (f.status === 'cerrado' && (!f.closedBy?.trim() || !f.closureJustification.trim()))
      throw new Error('El cierre necesita responsable y justificación.');
  for (const a of db.attachments) {
    if (!entities[a.entityType].has(a.entityId) || !Number.isInteger(a.size) || a.size <= 0)
      throw new Error('Adjunto o relación inválida.');
  }
  const attachments = ids(db.attachments);
  for (const v of db.versions)
    if (!entities[v.entityType].has(v.entityId) || !attachments.has(v.attachmentId))
      throw new Error('Versión documental inválida.');
    else if (
      !db.attachments.some(
        (a) =>
          a.id === v.attachmentId &&
          a.entityId === v.entityId &&
          a.entityType === v.entityType &&
          a.version === v.version,
      )
    )
      throw new Error('La versión no coincide con el archivo del registro.');
  for (const r of db.reviews)
    if (!entities[r.entityType].has(r.entityId) || !r.responsible.trim() || !r.notes.trim())
      throw new Error('Revisión incompleta.');
  for (const d of db.documents)
    if (
      (d.installationId && !entities.installation.has(d.installationId)) ||
      (d.findingId && !entities.finding.has(d.findingId))
    )
      throw new Error('Relación documental inválida.');
  for (const row of [...db.studies, ...db.documents])
    if (row.lastReviewedAt && row.lastReviewedAt < row.originalDate)
      throw new Error('La revisión no puede preceder al documento original.');
}
