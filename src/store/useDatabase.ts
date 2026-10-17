import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { z } from 'zod';
import { createDemoDatabase } from '../domain/seed';
import { calendarDate } from '../domain/dates';
import {
  assertIntegrity,
  documentSchema,
  findingSchema,
  ppeSchema,
  studySchema,
} from '../domain/validation';
import type {
  ArcFlashStudy,
  DemoDatabase,
  DocumentRecord,
  FindingInput,
  PPEItem,
} from '../domain/types';

export const STORAGE_KEY = 'sigee-demo';
export const STORAGE_VERSION = 1;
let recoveryNotice = '';
export const getRecoveryNotice = () => recoveryNotice;
export const safeStorage: StateStorage = {
  getItem(name) {
    let raw: string | null;
    try {
      raw = localStorage.getItem(name);
    } catch {
      recoveryNotice =
        'No se pudo acceder al almacenamiento local. Los cambios durarán solo durante esta sesión.';
      return null;
    }
    if (!raw) return null;
    try {
      const stored: unknown = JSON.parse(raw);
      const envelope = z
        .object({ version: z.literal(STORAGE_VERSION), state: z.object({ db: z.unknown() }) })
        .parse(stored);
      assertIntegrity(envelope.state.db as DemoDatabase);
      return raw;
    } catch {
      recoveryNotice =
        'Los datos locales eran incompatibles o estaban dañados. Se recuperó la demostración.';
      const recovered = JSON.stringify({
        version: STORAGE_VERSION,
        state: { db: createDemoDatabase() },
      });
      safeStorage.setItem(name, recovered);
      return recovered;
    }
  },
  setItem(name, value) {
    try {
      localStorage.setItem(name, value);
    } catch {
      recoveryNotice =
        'El navegador no permite guardar cambios. Se conservarán solo durante esta sesión.';
    }
  },
  removeItem(name) {
    try {
      localStorage.removeItem(name);
    } catch {
      /* Sin acceso al almacenamiento. */
    }
  },
};

interface DatabaseStore {
  db: DemoDatabase;
  saveFinding: (input: FindingInput, id?: string) => string;
  removeFinding: (id: string) => void;
  addComment: (id: string, text: string) => void;
  savePPE: (id: string, input: Omit<PPEItem, 'id' | 'code'>) => void;
  assignPPE: (ppeId: string, assetId: string, quantity: number) => void;
  releaseAssignment: (id: string) => void;
  saveStudy: (id: string, input: Omit<ArcFlashStudy, 'id'>) => void;
  saveDocument: (id: string, input: Omit<DocumentRecord, 'id'>) => void;
  reset: () => void;
}

export const useDatabase = create<DatabaseStore>()(
  persist(
    (set, get) => {
      const commit = (db: DemoDatabase) => {
        assertIntegrity(db);
        set({ db });
      };
      return {
        db: createDemoDatabase(),
        saveFinding(raw, id) {
          const input = findingSchema.parse(raw);
          const db = get().db;
          if (!db.assets.some((a) => a.id === input.assetId))
            throw new Error('Selecciona un activo existente.');
          const old = id ? db.findings.find((f) => f.id === id) : undefined;
          if (id && !old) throw new Error('No se encontró el hallazgo.');
          const now = new Date().toISOString();
          if (input.dueDate < calendarDate(old?.createdAt ?? now))
            throw new Error('La fecha objetivo no puede ser anterior a la creación.');
          const finding = {
            ...input,
            id: old?.id ?? crypto.randomUUID(),
            code:
              old?.code ??
              `HAL-${String(Math.max(0, ...db.findings.map((f) => Number(f.code.split('-')[1]) || 0)) + 1).padStart(3, '0')}`,
            createdAt: old?.createdAt ?? now,
            ...(input.status === 'cerrado' ? { closedAt: old?.closedAt ?? now } : {}),
          };
          const changes = old
            ? (
                [
                  'title',
                  'description',
                  'assetId',
                  'priority',
                  'status',
                  'responsible',
                  'dueDate',
                ] as const
              )
                .filter((k) => old[k] !== finding[k])
                .map((field) => ({ field, before: old[field], after: finding[field] }))
            : [];
          const event = {
            id: crypto.randomUUID(),
            findingId: finding.id,
            at: now,
            kind: old ? ('cambio' as const) : ('creación' as const),
            text: old ? 'Se actualizó el hallazgo.' : 'Se registró el hallazgo.',
            changes,
          };
          commit({
            ...db,
            findings: old
              ? db.findings.map((f) => (f.id === id ? finding : f))
              : [...db.findings, finding],
            findingEvents:
              old && changes.length === 0 ? db.findingEvents : [...db.findingEvents, event],
          });
          return finding.id;
        },
        removeFinding(id) {
          const db = get().db;
          if (!db.findings.some((f) => f.id === id)) throw new Error('No se encontró el hallazgo.');
          commit({
            ...db,
            findings: db.findings.filter((f) => f.id !== id),
            findingEvents: db.findingEvents.filter((e) => e.findingId !== id),
          });
        },
        addComment(id, raw) {
          const text = z.string().trim().min(1, 'Escribe un comentario.').max(3000).parse(raw);
          const db = get().db;
          if (!db.findings.some((f) => f.id === id)) throw new Error('El hallazgo ya no existe.');
          commit({
            ...db,
            findingEvents: [
              ...db.findingEvents,
              {
                id: crypto.randomUUID(),
                findingId: id,
                at: new Date().toISOString(),
                kind: 'comentario',
                text,
              },
            ],
          });
        },
        savePPE(id, raw) {
          const db = get().db;
          if (!db.ppe.some((r) => r.id === id)) throw new Error('No se encontró el registro EPP.');
          const input = ppeSchema.parse(raw);
          commit({ ...db, ppe: db.ppe.map((p) => (p.id === id ? { ...p, ...input } : p)) });
        },
        assignPPE(ppeId, assetId, quantity) {
          const db = get().db;
          const ppe = db.ppe.find((p) => p.id === ppeId);
          if (!ppe || !db.assets.some((a) => a.id === assetId))
            throw new Error('Selecciona un EPP y un activo existentes.');
          if (!Number.isInteger(quantity) || quantity <= 0 || quantity > ppe.available)
            throw new Error(
              'La cantidad debe ser entera, positiva y no superar las unidades disponibles.',
            );
          commit({
            ...db,
            ppe: db.ppe.map((p) =>
              p.id === ppeId ? { ...p, available: p.available - quantity } : p,
            ),
            assignments: [
              ...db.assignments,
              {
                id: crypto.randomUUID(),
                ppeId,
                assetId,
                quantity,
                assignedAt: new Date().toISOString(),
              },
            ],
          });
        },
        releaseAssignment(id) {
          const db = get().db;
          const assignment = db.assignments.find((a) => a.id === id);
          if (!assignment) throw new Error('No se encontró la asignación.');
          commit({
            ...db,
            ppe: db.ppe.map((p) =>
              p.id === assignment.ppeId
                ? { ...p, available: p.available + assignment.quantity }
                : p,
            ),
            assignments: db.assignments.filter((a) => a.id !== id),
          });
        },
        saveStudy(id, raw) {
          const db = get().db;
          if (!db.studies.some((r) => r.id === id)) throw new Error('No se encontró el estudio.');
          const input = studySchema.parse(raw);
          commit({ ...db, studies: db.studies.map((s) => (s.id === id ? { ...s, ...input } : s)) });
        },
        saveDocument(id, raw) {
          const db = get().db;
          if (!db.documents.some((r) => r.id === id))
            throw new Error('No se encontró el documento.');
          const input = documentSchema.parse(raw);
          commit({
            ...db,
            documents: db.documents.map((d) =>
              d.id === id ? { ...d, ...input, assetId: input.assetId || undefined } : d,
            ),
          });
        },
        reset() {
          commit(createDemoDatabase());
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: STORAGE_VERSION,
      storage: createJSONStorage<{ db: DemoDatabase }>(() => safeStorage),
      partialize: (state) => ({ db: state.db }),
    },
  ),
);
