import { create } from 'zustand';
import { z } from 'zod';
import { createDemoDatabase } from '../domain/seed';
import { calendarDate, today } from '../domain/dates';
import {
  findingSchema,
  ppeSchema,
  studySchema,
  documentSchema,
  dateSchema,
} from '../domain/validation';
import { readDatabase, writeDatabase, validateFile } from '../persistence/database';
import { reconcileAlerts } from '../domain/alerts-v2';
import type { FindingInput, PPEItem, ArcFlashStudy, DocumentRecord } from '../domain/types';
import type {
  DatabaseV2,
  EntityKind,
  FindingDraft,
  InventoryMovement,
  UnavailableReason,
  Attachment,
  InstallationV2,
  AssetV2,
  PPEV2,
  StudyV2,
  DocumentV2,
} from '../domain/v2';
export { STORAGE_KEY, STORAGE_VERSION, getRecoveryNotice } from '../persistence/database';
const text = z.string().trim().min(1, 'Este campo es obligatorio.').max(200);
export const installationSchema = z.object({
  code: text,
  name: text,
  location: text,
  description: z.string().max(3000),
  responsible: text,
});
export const assetSchema = z.object({
  code: text,
  name: text,
  installationId: text,
  type: text,
  nominalVoltage: text,
  administrativeStatus: z.enum(['registrado', 'en revisión']),
  operationalStatus: z.enum([
    'sin verificar',
    'registrado en servicio',
    'registrado fuera de servicio',
    'retirado',
  ]),
  description: z.string().max(3000),
  responsible: text,
});
const tableFor = {
  installation: 'installations',
  asset: 'assets',
  finding: 'findings',
  ppe: 'ppe',
  study: 'studies',
  document: 'documents',
} as const;
interface Store {
  db: DatabaseV2;
  ready: boolean;
  loadingFiles: boolean;
  busy: boolean;
  error: string;
  initialize: () => Promise<void>;
  saveFinding: (input: FindingDraft, id?: string) => Promise<string>;
  removeFinding: (id: string) => Promise<void>;
  addComment: (id: string, text: string) => Promise<void>;
  savePPE: (id: string, input: Omit<PPEItem, 'id' | 'code'>) => Promise<void>;
  assignPPE: (
    ppeId: string,
    assetId: string,
    quantity: number,
    details?: { responsible?: string; activity?: string; expectedReturn?: string; notes?: string },
  ) => Promise<void>;
  releaseAssignment: (id: string, condition?: 'disponible' | UnavailableReason) => Promise<void>;
  saveStudy: (id: string, input: Omit<ArcFlashStudy, 'id'>) => Promise<void>;
  saveDocument: (id: string, input: Omit<DocumentRecord, 'id'>) => Promise<void>;
  saveRecord: (
    kind: Exclude<EntityKind, 'alert' | 'finding'>,
    input: Record<string, unknown>,
    id?: string,
  ) => Promise<string>;
  archive: (kind: Exclude<EntityKind, 'alert'>, id: string) => Promise<void>;
  movePPE: (
    id: string,
    input: {
      type: 'entrada' | 'inspección' | 'cambio de estado' | 'corrección' | 'baja';
      quantity: number;
      from: 'disponible' | UnavailableReason;
      to: 'disponible' | UnavailableReason;
      responsible: string;
      source: string;
      notes: string;
      date: string;
      nextInspection?: string;
    },
  ) => Promise<void>;
  upload: (
    kind: Attachment['entityType'],
    id: string,
    file: File,
    version: string,
    notes: string,
  ) => Promise<void>;
  review: (
    kind: 'study' | 'document',
    id: string,
    input: { date: string; responsible: string; notes: string; nextReview: string },
  ) => Promise<void>;
  acknowledge: (id: string) => Promise<void>;
  refreshAlerts: () => Promise<void>;
  reset: () => Promise<void>;
  seedFiles: () => Promise<void>;
}
let queue: Promise<unknown> = Promise.resolve();
let initialization: Promise<void> | undefined;
export const useDatabase = create<Store>((set, get) => {
  const audit = (
    db: DatabaseV2,
    entityType: EntityKind,
    entityId: string,
    action: string,
    description: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
    actor = 'Usuario de demostración',
  ) =>
    db.events.push({
      id: crypto.randomUUID(),
      entityType,
      entityId,
      action,
      description,
      before,
      after,
      actor,
      at: new Date().toISOString(),
    });
  const transact = <T>(
    operation: (db: DatabaseV2, files: { id: string; blob: Blob }[]) => T | Promise<T>,
    resetFiles = false,
  ): Promise<T> => {
    const task = queue
      .catch(() => {})
      .then(async () => {
        if (!get().ready) throw new Error('Espera a que finalice la carga de datos.');
        set({ busy: true, error: '' });
        try {
          const db = structuredClone(get().db),
            files: { id: string; blob: Blob }[] = [];
          const result = await operation(db, files);
          reconcileAlerts(db);
          if (!resetFiles && !files.length && JSON.stringify(db) === JSON.stringify(get().db))
            return result;
          await writeDatabase(db, files, resetFiles);
          set({ db });
          return result;
        } catch (e) {
          set({ error: e instanceof Error ? e.message : 'No se pudo guardar la operación.' });
          throw e;
        } finally {
          set({ busy: false });
        }
      });
    queue = task;
    return task;
  };
  const updateBalance = (db: DatabaseV2, id: string) => {
    const p = db.ppe.find((p) => p.id === id);
    if (!p) throw new Error('EPP inexistente.');
    const moves = db.movements.filter((m) => m.ppeId === id);
    p.available = moves.reduce((s, m) => s + m.availableDelta, 0);
    p.unavailable = moves.reduce(
      (s, m) => s + Object.values(m.unavailableDelta).reduce((a, n) => a + (n ?? 0), 0),
      0,
    );
    p.total = p.available + p.unavailable + moves.reduce((s, m) => s + m.assignedDelta, 0);
    p.updatedAt = new Date().toISOString();
  };
  const movement = (
    db: DatabaseV2,
    id: string,
    m: Omit<InventoryMovement, 'id' | 'ppeId' | 'at'>,
    at = new Date().toISOString(),
  ) => {
    db.movements.push({ ...m, id: crypto.randomUUID(), ppeId: id, at });
    updateBalance(db, id);
    audit(
      db,
      'ppe',
      id,
      m.type,
      `${m.quantity} unidad(es). ${m.notes}`,
      undefined,
      { ...m },
      m.responsible,
    );
  };
  const find = (db: DatabaseV2, kind: Exclude<EntityKind, 'alert'>, id: string) => {
    const value = db[tableFor[kind]].find((r) => r.id === id);
    if (!value) throw new Error('No se encontró el registro.');
    return value;
  };
  return {
    db: createDemoDatabase(),
    ready: false,
    loadingFiles: true,
    busy: false,
    error: '',
    initialize() {
      if (initialization) return initialization;
      initialization = (async () => {
        try {
          const db = await readDatabase();
          reconcileAlerts(db);
          await writeDatabase(db);
          set({ db, ready: true, error: '' });
          try {
            await get().seedFiles();
          } catch (e) {
            set({
              error:
                e instanceof Error ? e.message : 'No se pudieron preparar los archivos de ejemplo.',
            });
          }
          set({ loadingFiles: false });
        } catch (e) {
          set({
            error: e instanceof Error ? e.message : 'No se pudo abrir IndexedDB.',
            ready: false,
            loadingFiles: false,
          });
          initialization = undefined;
        }
      })();
      return initialization;
    },
    saveFinding(raw, id) {
      return transact((db) => {
        const input = findingSchema.parse(raw);
        const asset = db.assets.find((a) => a.id === input.assetId && !a.archived);
        if (!asset && !(id && db.findings.some((f) => f.id === id && f.assetId === input.assetId)))
          throw new Error('Selecciona un activo existente y activo.');
        const old = id ? db.findings.find((f) => f.id === id) : undefined;
        if (id && !old) throw new Error('No se encontró el hallazgo.');
        const before = old ? structuredClone(old) : undefined;
        const now = new Date().toISOString();
        if (input.dueDate < calendarDate(old?.createdAt ?? now))
          throw new Error('La fecha objetivo no puede ser anterior a la creación.');
        const record = {
          ...old,
          ...input,
          id: old?.id ?? crypto.randomUUID(),
          code:
            old?.code ??
            `HAL-${String(Math.max(0, ...db.findings.map((f) => Number(f.code.split('-')[1]) || 0)) + 1).padStart(3, '0')}`,
          createdAt: old?.createdAt ?? now,
          updatedAt: now,
          provenance: old?.provenance ?? ('sesión' as const),
          installationId: db.assets.find((a) => a.id === input.assetId)!.installationId,
          correctiveAction: raw.correctiveAction ?? old?.correctiveAction ?? '',
          closureJustification: raw.closureJustification ?? old?.closureJustification ?? '',
          closedBy: input.status === 'cerrado' ? (raw.closedBy ?? input.responsible) : undefined,
          closedAt: input.status === 'cerrado' ? (old?.closedAt ?? now) : undefined,
        };
        if (
          input.status === 'cerrado' &&
          (!record.closureJustification.trim() || !record.correctiveAction.trim())
        )
          throw new Error('Para cerrar, registra la acción correctiva y la justificación.');
        const changes = old
          ? Object.entries(input)
              .filter(([key, value]) => old[key as keyof FindingInput] !== value)
              .map(([field, after]) => ({
                field,
                before: String(old[field as keyof FindingInput] ?? ''),
                after: String(after),
              }))
          : [];
        if (old) Object.assign(old, record);
        else db.findings.push(record);
        db.findingEvents.push({
          id: crypto.randomUUID(),
          findingId: record.id,
          at: now,
          kind: old ? 'cambio' : 'creación',
          text: old ? 'Se actualizó el hallazgo.' : 'Se registró el hallazgo.',
          changes,
        });
        audit(
          db,
          'finding',
          record.id,
          input.status === 'cerrado' ? 'cierre' : old ? 'edición' : 'creación',
          record.title,
          before ? { ...before } : undefined,
          { ...record },
        );
        return record.id;
      });
    },
    removeFinding(id) {
      return get().archive('finding', id);
    },
    addComment(id, raw) {
      return transact((db) => {
        const value = z.string().trim().min(1, 'Escribe un comentario.').max(3000).parse(raw);
        find(db, 'finding', id);
        const at = new Date().toISOString();
        db.findingEvents.push({
          id: crypto.randomUUID(),
          findingId: id,
          at,
          kind: 'comentario',
          text: value,
        });
        audit(db, 'finding', id, 'seguimiento', value);
      });
    },
    savePPE(id, raw) {
      return transact((db) => {
        const item = db.ppe.find((p) => p.id === id);
        if (!item) throw new Error('EPP inexistente.');
        const input = ppeSchema.parse(raw);
        if (
          item.total !== input.total ||
          item.available !== input.available ||
          item.unavailable !== input.unavailable
        )
          throw new Error('Las cantidades se modifican mediante movimientos de inventario.');
        const before = { ...item };
        Object.assign(item, input, { updatedAt: new Date().toISOString() });
        audit(db, 'ppe', id, 'edición', 'Metadatos EPP actualizados.', before, { ...item });
      });
    },
    assignPPE(ppeId, assetId, quantity, details = {}) {
      return transact((db) => {
        const item = db.ppe.find((p) => p.id === ppeId && !p.archived);
        if (!item || !db.assets.some((a) => a.id === assetId && !a.archived))
          throw new Error('Selecciona un EPP y activo existentes y activos.');
        if (!Number.isInteger(quantity) || quantity <= 0 || quantity > item.available)
          throw new Error('La cantidad debe ser positiva y no superar la disponibilidad.');
        const id = crypto.randomUUID();
        const responsible = text.parse(details.responsible?.trim() || 'Usuario de demostración');
        if (details.expectedReturn) {
          dateSchema.parse(details.expectedReturn);
          if (details.expectedReturn < today())
            throw new Error('La devolución prevista no puede estar en el pasado.');
        }
        db.assignments.push({
          id,
          ppeId,
          assetId,
          quantity,
          assignedAt: new Date().toISOString(),
          responsible,
          activity: details.activity ?? '',
          expectedReturn: details.expectedReturn,
          notes: details.notes ?? '',
        });
        movement(db, ppeId, {
          type: 'asignación',
          quantity,
          availableDelta: -quantity,
          assignedDelta: quantity,
          unavailableDelta: {},
          responsible,
          source: assetId,
          notes: details.notes ?? 'Asignación ficticia.',
          assignmentId: id,
        });
      });
    },
    releaseAssignment(id, condition = 'pendiente de inspección') {
      return transact((db) => {
        const assignment = db.assignments.find((a) => a.id === id && !a.returnedAt);
        if (!assignment) throw new Error('La asignación no está activa.');
        assignment.returnedAt = new Date().toISOString();
        movement(db, assignment.ppeId, {
          type: 'devolución',
          quantity: assignment.quantity,
          availableDelta: condition === 'disponible' ? assignment.quantity : 0,
          assignedDelta: -assignment.quantity,
          unavailableDelta: condition === 'disponible' ? {} : { [condition]: assignment.quantity },
          responsible: assignment.responsible,
          source: assignment.assetId,
          notes: `Estado de recepción: ${condition}.`,
          assignmentId: id,
        });
      });
    },
    saveStudy(id, raw) {
      return get()
        .saveRecord('study', { ...studySchema.parse(raw) }, id)
        .then(() => {});
    },
    saveDocument(id, raw) {
      return get()
        .saveRecord('document', { ...documentSchema.parse(raw) }, id)
        .then(() => {});
    },
    saveRecord(kind, raw, id) {
      return transact((db) => {
        const now = new Date().toISOString(),
          old = id ? find(db, kind, id) : undefined;
        const before = old ? { ...structuredClone(old) } : undefined;
        const common = {
          id: id ?? crypto.randomUUID(),
          createdAt: old?.createdAt ?? now,
          updatedAt: now,
          provenance: old?.provenance ?? ('sesión' as const),
          archived: old?.archived ?? false,
        };
        let record: InstallationV2 | AssetV2 | PPEV2 | StudyV2 | DocumentV2;
        if (kind === 'installation') {
          const row = { ...common, ...installationSchema.parse(raw) };
          if (db.installations.some((r) => r.code === row.code && r.id !== id))
            throw new Error('El código de instalación ya existe.');
          if (old) Object.assign(old, row);
          else db.installations.push(row);
          record = row;
        } else if (kind === 'asset') {
          const input = assetSchema.parse(raw),
            previous = db.assets.find((a) => a.id === id);
          if (
            !db.installations.some(
              (i) =>
                i.id === input.installationId && (!i.archived || previous?.installationId === i.id),
            )
          )
            throw new Error('Selecciona una instalación activa.');
          const row = { ...common, ...input };
          if (db.assets.some((r) => r.code === row.code && r.id !== id))
            throw new Error('El código de activo ya existe.');
          if (old) Object.assign(old, row);
          else db.assets.push(row);
          record = row;
        } else if (kind === 'ppe') {
          const input = z
            .object({
              code: text,
              type: text,
              reference: text,
              category: text,
              manufacturer: z.string().max(200),
              description: z.string().max(3000),
              location: text,
              notes: z.string().max(3000),
              nextInspection: z.union([dateSchema, z.literal('')]),
              installationId: z.string().optional(),
              initialQuantity: z.number().int().nonnegative().optional(),
            })
            .parse(raw);
          if (db.ppe.some((r) => r.code === input.code && r.id !== id))
            throw new Error('El código EPP ya existe.');
          const previous = db.ppe.find((p) => p.id === id);
          const row: PPEV2 = {
            ...common,
            total: 0,
            available: 0,
            unavailable: 0,
            inspectionStatus: 'pendiente',
            ...previous,
            ...input,
            installationId: input.installationId || undefined,
            updatedAt: now,
          };
          if (old) Object.assign(old, row);
          else {
            db.ppe.push(row);
            if (input.initialQuantity)
              movement(db, row.id, {
                type: 'entrada',
                quantity: input.initialQuantity,
                availableDelta: 0,
                assignedDelta: 0,
                unavailableDelta: { 'pendiente de inspección': input.initialQuantity },
                responsible: 'Usuario de demostración',
                source: 'Registro inicial',
                notes: 'Entrada pendiente de inspección.',
              });
          }
          record = row;
        } else if (kind === 'study') {
          const input = studySchema.parse(raw);
          if (input.studyDate > today())
            throw new Error('La fecha original del estudio no puede ser futura.');
          const previous = db.studies.find((r) => r.id === id);
          if (db.studies.some((r) => r.reference === input.reference && r.id !== id))
            throw new Error('La referencia de estudio ya existe.');
          const technical = {
            ...(previous?.technical ?? {
              nominalVoltage: '',
              shortCircuitCurrent: '',
              workingDistance: '',
              incidentEnergy: '',
              arcBoundary: '',
              methodology: '',
              assumptions: '',
              conclusions: '',
            }),
          };
          for (const key of Object.keys(technical) as (keyof typeof technical)[])
            if (typeof raw[key] === 'string') technical[key] = z.string().max(3000).parse(raw[key]);
          const row: StudyV2 = {
            ...common,
            ...previous,
            ...input,
            title: text.parse(raw.title ?? previous?.title ?? input.reference),
            objective: z
              .string()
              .max(3000)
              .parse(raw.objective ?? previous?.objective ?? ''),
            scope: z
              .string()
              .max(3000)
              .parse(raw.scope ?? previous?.scope ?? ''),
            observations: z
              .string()
              .max(3000)
              .parse(raw.observations ?? previous?.observations ?? ''),
            originalDate: input.studyDate,
            technical,
            documentState: z
              .enum(['borrador', 'en revisión', 'aprobado administrativamente', 'archivado'])
              .parse(raw.documentState ?? previous?.documentState ?? 'borrador'),
            updatedAt: now,
          };
          row.archived = row.documentState === 'archivado';
          if (row.lastReviewedAt && row.originalDate > row.lastReviewedAt)
            throw new Error('La fecha original no puede ser posterior a su última revisión.');
          if (old) Object.assign(old, row);
          else db.studies.push(row);
          record = row;
        } else {
          const input = documentSchema.parse(raw),
            previous = db.documents.find((r) => r.id === id);
          if (db.documents.some((r) => r.code === input.code && r.id !== id))
            throw new Error('El código documental ya existe.');
          const row: DocumentV2 = {
            ...common,
            ...previous,
            ...input,
            assetId: input.assetId || undefined,
            installationId:
              String(raw.installationId ?? previous?.installationId ?? '') || undefined,
            findingId: String(raw.findingId ?? previous?.findingId ?? '') || undefined,
            originalDate: dateSchema.parse(raw.originalDate ?? previous?.originalDate ?? today()),
            description: z
              .string()
              .max(3000)
              .parse(raw.description ?? previous?.description ?? ''),
            documentState: z
              .enum(['borrador', 'en revisión', 'aprobado administrativamente', 'archivado'])
              .parse(raw.documentState ?? previous?.documentState ?? 'borrador'),
            updatedAt: now,
          };
          if (row.originalDate > today()) throw new Error('La fecha original no puede ser futura.');
          if (row.reviewDate && row.reviewDate < row.originalDate)
            throw new Error('La próxima revisión no puede preceder al documento original.');
          row.archived = row.documentState === 'archivado';
          if (row.lastReviewedAt && row.originalDate > row.lastReviewedAt)
            throw new Error('La fecha original no puede ser posterior a su última revisión.');
          if (old) Object.assign(old, row);
          else db.documents.push(row);
          record = row;
        }
        audit(
          db,
          kind,
          record.id,
          old ? 'edición' : 'creación',
          old
            ? 'Metadatos actualizados; esto no constituye una revisión técnica.'
            : 'Registro creado.',
          before,
          { ...record },
        );
        return record.id;
      });
    },
    archive(kind, id) {
      return transact((db) => {
        const row = find(db, kind, id),
          before = { archived: row.archived ?? false };
        row.archived = !row.archived;
        if ('documentState' in row) row.documentState = row.archived ? 'archivado' : 'borrador';
        row.updatedAt = new Date().toISOString();
        audit(
          db,
          kind,
          id,
          'baja administrativa',
          row.archived
            ? 'Registro archivado; conserva relaciones e historial.'
            : 'Registro reactivado.',
          before,
          { archived: row.archived },
        );
      });
    },
    movePPE(id, input) {
      return transact((db) => {
        z.enum(['entrada', 'inspección', 'cambio de estado', 'corrección', 'baja']).parse(
          input.type,
        );
        const reasons = z.enum([
          'disponible',
          'pendiente de inspección',
          'en inspección',
          'deteriorado',
          'en cuarentena',
          'retirado temporalmente',
          'dado de baja',
        ]);
        reasons.parse(input.from);
        reasons.parse(input.to);
        const item = db.ppe.find((p) => p.id === id);
        if (!item || item.archived) throw new Error('Selecciona una referencia EPP activa.');
        if (input.type === 'baja' && input.to !== 'dado de baja')
          throw new Error('Una baja debe tener como destino dado de baja.');
        const quantity = z
          .number()
          .int()
          .positive('Indica una cantidad entera positiva.')
          .parse(input.quantity);
        text.parse(input.responsible);
        dateSchema.parse(input.date);
        if (input.date > today()) throw new Error('No se permiten movimientos futuros.');
        const last = db.movements
          .filter((m) => m.ppeId === id)
          .sort((a, b) => a.at.localeCompare(b.at))
          .at(-1);
        if (last && input.date < calendarDate(last.at))
          throw new Error('El movimiento no puede preceder al último registrado.');
        if (!input.notes.trim() || !input.source.trim())
          throw new Error('Indica la procedencia y el motivo del movimiento.');
        if (input.type === 'entrada' && input.to === 'disponible')
          throw new Error(
            'Las entradas deben recibirse como no disponibles hasta registrar inspección.',
          );
        if (input.type !== 'entrada' && input.type !== 'inspección' && input.from === input.to)
          throw new Error('El estado de origen y destino deben ser distintos.');
        if (input.type !== 'entrada') {
          const balance =
            input.from === 'disponible'
              ? item.available
              : db.movements
                  .filter((m) => m.ppeId === id)
                  .reduce(
                    (sum, m) => sum + (m.unavailableDelta[input.from as UnavailableReason] ?? 0),
                    0,
                  );
          if (quantity > balance)
            throw new Error('La cantidad supera el saldo del estado de origen.');
        }
        if (input.nextInspection) {
          dateSchema.parse(input.nextInspection);
          if (input.nextInspection < input.date)
            throw new Error('La próxima inspección no puede preceder a la realizada.');
        }
        const delta: Partial<Record<UnavailableReason, number>> = {};
        let availableDelta = 0;
        if (input.type !== 'entrada') {
          if (input.from === 'disponible') availableDelta -= quantity;
          else delta[input.from] = -quantity;
        }
        if (input.to === 'disponible') availableDelta += quantity;
        else delta[input.to] = (delta[input.to] ?? 0) + quantity;
        movement(
          db,
          id,
          {
            type: input.type,
            quantity,
            availableDelta,
            assignedDelta: 0,
            unavailableDelta: delta,
            responsible: input.responsible,
            source: input.source,
            notes: input.notes,
          },
          input.date === today() ? new Date().toISOString() : `${input.date}T17:00:00.000Z`,
        );
        const p = db.ppe.find((p) => p.id === id)!;
        if (input.type === 'inspección') {
          p.lastInspection = input.date;
          p.inspectionStatus = input.to === 'disponible' ? 'registrada' : 'pendiente';
          if (input.nextInspection) p.nextInspection = input.nextInspection;
        }
      });
    },
    upload(kind, id, file, version, notes) {
      return validateFile(file, kind === 'finding' || kind === 'ppe').then(() =>
        transact((db, files) => {
          find(db, kind, id);
          text.parse(version);
          const duplicate = db.versions.some(
            (v) => v.entityType === kind && v.entityId === id && v.version === version,
          );
          if ((kind === 'study' || kind === 'document') && duplicate)
            throw new Error('Esta versión ya tiene un archivo; registra otra versión.');
          const now = new Date().toISOString(),
            attachment = {
              id: crypto.randomUUID(),
              entityType: kind,
              entityId: id,
              name: file.name,
              mime: file.type,
              size: file.size,
              uploadedAt: now,
              version,
              notes,
            };
          db.attachments.push(attachment);
          files.push({ id: attachment.id, blob: file });
          if (kind === 'document' || kind === 'study') {
            db.versions.push({
              id: crypto.randomUUID(),
              entityType: kind,
              entityId: id,
              version,
              attachmentId: attachment.id,
              at: now,
              notes,
            });
            const row =
              kind === 'study'
                ? db.studies.find((s) => s.id === id)!
                : db.documents.find((d) => d.id === id)!;
            row.version = version;
            row.uploadedAt = now;
            row.updatedAt = now;
          }
          audit(db, kind, id, 'carga documental', `${file.name} · Versión ${version}`, undefined, {
            attachmentId: attachment.id,
            version,
          });
        }),
      );
    },
    review(kind, id, input) {
      return transact((db) => {
        dateSchema.parse(input.date);
        if (input.date > today())
          throw new Error('La revisión realizada no puede estar en el futuro.');
        text.parse(input.responsible);
        z.string().trim().min(1, 'Describe el alcance de la revisión.').parse(input.notes);
        if (input.nextReview) {
          dateSchema.parse(input.nextReview);
          if (input.nextReview < input.date)
            throw new Error('La próxima revisión debe ser posterior a la realizada.');
        }
        const row =
          kind === 'study'
            ? db.studies.find((s) => s.id === id)
            : db.documents.find((d) => d.id === id);
        if (!row) throw new Error('Registro inexistente.');
        if (row.lastReviewedAt && input.date < row.lastReviewedAt)
          throw new Error('La revisión no puede preceder a la última registrada.');
        if (input.date < row.originalDate)
          throw new Error('La revisión no puede preceder al documento original.');
        db.reviews.push({
          id: crypto.randomUUID(),
          entityType: kind,
          entityId: id,
          at: `${input.date}T17:00:00.000Z`,
          responsible: input.responsible,
          notes: input.notes,
          nextReview: input.nextReview,
          version: row.version,
        });
        row.lastReviewedAt = input.date;
        row.updatedAt = new Date().toISOString();
        row.status = 'registrado';
        if (kind === 'study') db.studies.find((s) => s.id === id)!.nextReview = input.nextReview;
        else db.documents.find((d) => d.id === id)!.reviewDate = input.nextReview;
        audit(db, kind, id, 'revisión', input.notes, undefined, { ...input }, input.responsible);
      });
    },
    acknowledge(id) {
      return transact((db) => {
        const alert = db.alertHistory.find((a) => a.id === id);
        if (!alert || alert.status === 'resuelta') throw new Error('El aviso no está activo.');
        alert.status = 'reconocida';
        alert.acknowledgedAt = new Date().toISOString();
        audit(db, 'alert', id, 'reconocimiento', 'Aviso reconocido. La condición sigue activa.');
      });
    },
    refreshAlerts() {
      return transact(() => {});
    },
    reset() {
      return transact((db) => {
        const seed = createDemoDatabase();
        Object.assign(db, seed);
      }, true).then(() => get().seedFiles());
    },
    async seedFiles() {
      const { createStudyPDF, createReferencePDF } = await import('../reports/pdf');
      const files: { id: string; blob: Blob; version?: string }[] = [];
      for (const study of get()
        .db.studies.filter((s) => s.provenance === 'demostración' || /^study-[123]$/.test(s.id))
        .slice(0, 3)) {
        if (!get().db.attachments.some((a) => a.entityId === study.id)) {
          files.push({ id: study.id, blob: await createStudyPDF(get().db, study.id) });
        }
      }
      for (const doc of get()
        .db.documents.filter((d) => d.provenance === 'demostración' || /^doc-[12]$/.test(d.id))
        .slice(0, 2)) {
        if (!get().db.attachments.some((a) => a.entityId === doc.id)) {
          if (doc.id === 'doc-1') {
            const previous = structuredClone(get().db);
            previous.documents.find((d) => d.id === doc.id)!.version = '0.9-demo';
            files.push({
              id: doc.id,
              version: '0.9-demo',
              blob: await createReferencePDF(previous, doc.id),
            });
          }
          files.push({ id: doc.id, blob: await createReferencePDF(get().db, doc.id) });
        }
      }
      if (!files.length) return;
      await transact((db, blobs) => {
        for (const file of files) {
          const isStudy = db.studies.some((s) => s.id === file.id),
            kind = isStudy ? ('study' as const) : ('document' as const);
          const id = crypto.randomUUID(),
            row = isStudy
              ? db.studies.find((s) => s.id === file.id)!
              : db.documents.find((d) => d.id === file.id)!;
          audit(
            db,
            kind,
            file.id,
            'carga documental',
            'PDF ilustrativo del conjunto demostrativo.',
          );
          const attachment = {
            id,
            entityType: kind,
            entityId: file.id,
            name: `${isStudy ? ('reference' in row ? row.reference : 'estudio') : 'code' in row ? row.code : 'documento'}-${file.version ?? row.version}-demostrativo.pdf`,
            mime: 'application/pdf',
            size: file.blob.size,
            uploadedAt: new Date().toISOString(),
            version: file.version ?? row.version,
            notes: 'Ejemplo ficticio generado por SIGEE, sin validación de ingeniería.',
          };
          row.uploadedAt = attachment.uploadedAt;
          row.updatedAt = attachment.uploadedAt;
          db.attachments.push(attachment);
          db.versions.push({
            id: crypto.randomUUID(),
            entityType: kind,
            entityId: file.id,
            version: attachment.version,
            attachmentId: id,
            at: attachment.uploadedAt,
            notes: attachment.notes,
          });
          blobs.push({ id, blob: file.blob });
        }
      });
    },
  };
});
