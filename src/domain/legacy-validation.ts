import { z } from 'zod';
import { isValid, parseISO } from 'date-fns';
import type { DemoDatabase, PPEItem } from './types';
import { calendarDate } from './dates';

z.config(z.locales.es());

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona una fecha válida.')
  .refine((v) => isValid(parseISO(v)), 'Selecciona una fecha válida.');
const text = z
  .string()
  .trim()
  .min(1, 'Este campo es obligatorio.')
  .max(200, 'Usa como máximo 200 caracteres.');
export const findingSchema = z.object({
  assetId: text,
  title: text,
  description: z.string().trim().max(3000),
  priority: z.enum(['baja', 'media', 'alta']),
  status: z.enum(['abierto', 'en progreso', 'pendiente de verificación', 'cerrado']),
  responsible: text,
  dueDate: dateSchema,
});
export const ppeSchema = z.object({
  type: text,
  reference: text,
  total: z.number().int().nonnegative('La cantidad no puede ser negativa.'),
  available: z.number().int().nonnegative('La cantidad no puede ser negativa.'),
  unavailable: z.number().int().nonnegative('La cantidad no puede ser negativa.'),
  nextInspection: z.union([dateSchema, z.literal('')]),
  inspectionStatus: z.enum(['registrada', 'pendiente']),
  notes: z.string().max(3000),
});
const status = z.enum(['registrado', 'pendiente de revisión']);
export const studySchema = z.object({
  reference: text,
  assetId: text,
  studyDate: dateSchema,
  nextReview: z.union([dateSchema, z.literal('')]),
  version: text,
  responsible: text,
  status,
});
export const documentSchema = z.object({
  code: text,
  title: text,
  type: text,
  assetId: z.string().optional(),
  version: text,
  responsible: text,
  reviewDate: z.union([dateSchema, z.literal('')]),
  status,
});
const id = z.string().min(1);
const timestamp = z.iso.datetime();
export const databaseSchema = z.object({
  installations: z.array(z.object({ id, name: text, location: text })),
  assets: z.array(
    z.object({
      id,
      code: text,
      name: text,
      installationId: id,
      type: text,
      nominalVoltage: text,
      administrativeStatus: z.enum(['registrado', 'en revisión']),
    }),
  ),
  findings: z.array(
    findingSchema.extend({ id, code: text, createdAt: timestamp, closedAt: timestamp.optional() }),
  ),
  findingEvents: z.array(
    z.object({
      id,
      findingId: id,
      at: timestamp,
      kind: z.enum(['creación', 'cambio', 'comentario']),
      text: z.string().max(3000),
      changes: z.array(z.object({ field: text, before: z.string(), after: z.string() })).optional(),
    }),
  ),
  ppe: z.array(ppeSchema.extend({ id, code: text })),
  assignments: z.array(
    z.object({
      id,
      ppeId: id,
      assetId: id,
      quantity: z.number().int().positive(),
      assignedAt: timestamp,
    }),
  ),
  studies: z.array(studySchema.extend({ id })),
  documents: z.array(documentSchema.extend({ id })),
});

export function validateInventory(item: PPEItem, assigned: number): boolean {
  return (
    [item.total, item.available, item.unavailable, assigned].every(
      (v) => Number.isInteger(v) && v >= 0,
    ) && item.total === item.available + item.unavailable + assigned
  );
}

export function assertIntegrity(db: DemoDatabase): void {
  const base = databaseSchema.parse(db);
  for (const list of Object.values(base)) {
    if (new Set(list.map((r: { id: string }) => r.id)).size !== list.length)
      throw new Error('Existen identificadores duplicados.');
  }
  const assets = new Set(db.assets.map((a) => a.id));
  const installations = new Set(db.installations.map((i) => i.id));
  const findings = new Set(db.findings.map((f) => f.id));
  const ppe = new Set(db.ppe.map((p) => p.id));
  if (
    db.assets.some((a) => !installations.has(a.installationId)) ||
    db.findings.some(
      (f) =>
        !assets.has(f.assetId) ||
        (f.status === 'cerrado') !== Boolean(f.closedAt) ||
        f.dueDate < calendarDate(f.createdAt) ||
        (f.closedAt && f.closedAt < f.createdAt),
    ) ||
    db.findingEvents.some((e) => !findings.has(e.findingId)) ||
    db.assignments.some((a) => !assets.has(a.assetId) || !ppe.has(a.ppeId)) ||
    db.studies.some(
      (s) => !assets.has(s.assetId) || (Boolean(s.nextReview) && s.nextReview < s.studyDate),
    ) ||
    db.documents.some((d) => d.assetId && !assets.has(d.assetId))
  ) {
    throw new Error('Los registros contienen relaciones o fechas inconsistentes.');
  }
  for (const item of db.ppe) {
    const assigned = db.assignments
      .filter((a) => a.ppeId === item.id)
      .reduce((sum, a) => sum + a.quantity, 0);
    if (!validateInventory(item, assigned))
      throw new Error('El total debe coincidir con disponibles + no disponibles + asignadas.');
  }
}
