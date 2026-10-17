import { beforeEach, describe, expect, it } from 'vitest';
import { safeStorage, STORAGE_KEY, STORAGE_VERSION, useDatabase } from './useDatabase';
import { createDemoDatabase } from '../domain/seed';
import { assertIntegrity } from '../domain/validation';
import { deriveAlerts, selectMetrics } from '../domain/selectors';
import { today } from '../domain/dates';

const input = () => ({
  assetId: 'asset-1',
  title: 'Hallazgo de prueba',
  description: 'Texto ficticio',
  priority: 'alta' as const,
  status: 'abierto' as const,
  responsible: 'Responsable demo',
  dueDate: today(),
});
beforeEach(() => {
  localStorage.clear();
  useDatabase.getState().reset();
});

describe('Store transaccional y persistencia', () => {
  it('crea, edita, cierra, reabre y registra cambios de estado, responsable y fecha', () => {
    const store = useDatabase.getState();
    const initial = selectMetrics(store.db).open;
    const id = store.saveFinding(input());
    expect(selectMetrics(useDatabase.getState().db).open).toBe(initial + 1);
    store.saveFinding(
      { ...input(), status: 'cerrado', responsible: 'Otra persona', dueDate: '2099-12-31' },
      id,
    );
    const closed = useDatabase.getState().db;
    expect(closed.findings.find((f) => f.id === id)?.closedAt).toBeTruthy();
    expect(deriveAlerts(closed).some((a) => a.sourceId === id)).toBe(false);
    expect(
      closed.findingEvents
        .filter((e) => e.findingId === id)
        .flatMap((e) => e.changes ?? [])
        .map((c) => c.field),
    ).toEqual(expect.arrayContaining(['status', 'responsible', 'dueDate']));
    store.saveFinding(input(), id);
    expect(useDatabase.getState().db.findings.find((f) => f.id === id)?.closedAt).toBeUndefined();
    expect(deriveAlerts(useDatabase.getState().db).some((a) => a.sourceId === id)).toBe(true);
  });
  it('persiste y rehidrata los datos sin guardar funciones ni alertas', async () => {
    const id = useDatabase.getState().saveFinding(input());
    const raw = localStorage.getItem(STORAGE_KEY)!;
    expect(JSON.parse(raw).version).toBe(STORAGE_VERSION);
    expect(Object.keys(JSON.parse(raw).state)).toEqual(['db']);
    useDatabase.setState({ db: createDemoDatabase() });
    localStorage.setItem(STORAGE_KEY, raw);
    await useDatabase.persist.rehydrate();
    expect(useDatabase.getState().db.findings.some((f) => f.id === id)).toBe(true);
  });
  it('bloquea un activo inválido y una fecha anterior a creación sin mutar el estado', () => {
    const before = useDatabase.getState().db;
    expect(() =>
      useDatabase.getState().saveFinding({ ...input(), assetId: 'no-existe' }),
    ).toThrow();
    expect(() =>
      useDatabase.getState().saveFinding({ ...input(), dueDate: '2000-01-01' }),
    ).toThrow();
    expect(useDatabase.getState().db).toBe(before);
  });
  it('registra comentarios y elimina historial solo al eliminar explícitamente el hallazgo', () => {
    const store = useDatabase.getState();
    const id = store.saveFinding(input());
    store.addComment(id, 'Comentario ficticio.');
    expect(useDatabase.getState().db.findingEvents.some((e) => e.kind === 'comentario')).toBe(true);
    store.removeFinding(id);
    expect(useDatabase.getState().db.findingEvents.some((e) => e.findingId === id)).toBe(false);
    expect(() => assertIntegrity(useDatabase.getState().db)).not.toThrow();
  });
  it('reserva y devuelve EPP, bloqueando sobregiros y relaciones inválidas', () => {
    const store = useDatabase.getState();
    const available = store.db.ppe[0]!.available;
    expect(() => store.assignPPE('ppe-1', 'asset-1', available + 1)).toThrow();
    expect(() => store.assignPPE('ppe-1', 'no-existe', 1)).toThrow();
    expect(() => store.assignPPE('ppe-1', 'asset-1', -1)).toThrow();
    store.assignPPE('ppe-1', 'asset-1', 2);
    expect(useDatabase.getState().db.ppe[0]!.available).toBe(available - 2);
    const assignment = useDatabase.getState().db.assignments.at(-1)!;
    store.releaseAssignment(assignment.id);
    expect(useDatabase.getState().db.ppe[0]!.available).toBe(available);
    expect(() => store.savePPE('ppe-1', { ...store.db.ppe[0]!, total: 999 })).toThrow();
  });
  it('restaura exactamente el dataset original', () => {
    const store = useDatabase.getState();
    store.saveFinding(input());
    store.assignPPE('ppe-1', 'asset-1', 1);
    store.reset();
    expect(useDatabase.getState().db).toEqual(createDemoDatabase());
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.db).toEqual(createDemoDatabase());
  });
  it.each([
    '{json roto',
    JSON.stringify({ version: 999, state: { db: {} } }),
    JSON.stringify({ version: STORAGE_VERSION, state: { db: { assets: [] } } }),
  ])('recupera almacenamiento corrupto o incompatible: %s', (raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    expect(JSON.parse(safeStorage.getItem(STORAGE_KEY) as string).state.db).toEqual(
      createDemoDatabase(),
    );
  });
});
