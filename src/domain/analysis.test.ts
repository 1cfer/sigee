import { expect, it } from 'vitest';
import { createDemoDatabase } from './seed';
import { analyze, defaultFilters, periodRange } from './analysis';
import { reconcileAlerts } from './alerts-v2';
import { today } from './dates';
it('no duplica el saldo EPP al asignar una referencia a un activo de otra instalación', () => {
  const db = createDemoDatabase();
  db.assignments[0]!.assetId = 'asset-2';
  const filters = { ...defaultFilters(), installationId: 'inst-2' };
  expect(analyze(db, filters).db.ppe).toHaveLength(0);
  expect(analyze(db, { ...filters, installationId: 'inst-1' }).db.ppe).toHaveLength(12);
});
it('aplica instalación, período, prioridad y estado a listas y métricas explicables', () => {
  const db = createDemoDatabase();
  const filters = {
    ...defaultFilters(),
    period: 'custom',
    start: '2026-05-01',
    end: '2026-10-31',
    installationId: db.installations[0]!.id,
    priority: 'alta',
  };
  const a = analyze(db, filters);
  expect(a.open).toEqual(a.db.findings.filter((f) => f.status !== 'cerrado'));
  expect(a.metrics.high).toBe(a.high.length);
  expect(a.metrics.overdue).toBe(a.overdue.length);
  expect(
    a.db.findings.every(
      (f) =>
        f.priority === 'alta' &&
        db.assets.find((r) => r.id === f.assetId)?.installationId === filters.installationId,
    ),
  ).toBe(true);
  expect(a.db.assets.every((r) => r.installationId === filters.installationId)).toBe(true);
});
it('reconstruye el arrastre antes del período y conserva cierres históricos al reabrir', () => {
  const db = createDemoDatabase(),
    f = db.findings[0]!;
  f.createdAt = '2026-01-01T17:00:00.000Z';
  f.status = 'abierto';
  f.closedAt = undefined;
  db.findingEvents.push(
    {
      id: 'close',
      findingId: f.id,
      kind: 'cambio',
      at: '2026-05-05T17:00:00.000Z',
      text: 'Cierre',
      changes: [{ field: 'status', before: 'abierto', after: 'cerrado' }],
    },
    {
      id: 'reopen',
      findingId: f.id,
      kind: 'cambio',
      at: '2026-06-05T17:00:00.000Z',
      text: 'Reapertura',
      changes: [{ field: 'status', before: 'cerrado', after: 'abierto' }],
    },
  );
  const a = analyze(db, {
    ...defaultFilters(),
    period: 'custom',
    start: '2026-04-01',
    end: '2026-06-30',
  });
  expect(a.trend[0]!.pendingRecords).toContain(f);
  expect(a.trend[1]!.pendingRecords).not.toContain(f);
  expect(a.trend[2]!.pendingRecords).toContain(f);
  expect(a.trend[1]!.closedRecords).toContain(f);
  expect(
    a.trend.every(
      (t) =>
        t.pendientes === t.pendingRecords.length &&
        t.creados === t.createdRecords.length &&
        t.cerrados === t.closedRecords.length,
    ),
  ).toBe(true);
});
it('respeta límites personalizados dentro de un mes y no trata vacío como vencido', () => {
  const db = createDemoDatabase();
  const f = db.findings[0]!;
  f.createdAt = '2026-10-01T17:00:00.000Z';
  const a = analyze(db, {
    ...defaultFilters(),
    period: 'custom',
    start: '2026-10-15',
    end: '2026-10-20',
  });
  expect(a.trend[0]!.createdRecords).not.toContain(f);
  expect(a.db.findings).not.toContain(f);
});
it('resuelve, reactiva y evita duplicar condiciones con sus eventos conservados', () => {
  const db = createDemoDatabase();
  reconcileAlerts(db);
  const id = db.alertHistory.find((r) => r.sourceId === 'finding-1')!.id;
  db.findings[0]!.status = 'cerrado';
  reconcileAlerts(db);
  expect(db.alertHistory.find((r) => r.id === id)?.status).toBe('resuelta');
  db.findings[0]!.status = 'abierto';
  reconcileAlerts(db);
  reconcileAlerts(db);
  expect(db.alertHistory.filter((r) => r.id === id)).toHaveLength(1);
  expect(db.events.filter((e) => e.entityId === id).map((e) => e.action)).toEqual([
    'generación',
    'resolución',
    'reactivación',
  ]);
});
it('calcula meses, trimestres, semestres y año sin fechas fijas de demostración', () => {
  expect(periodRange('month', '2028-02', '', '')).toEqual({
    start: '2028-02-01',
    end: '2028-02-29',
  });
  expect(periodRange('quarter2', '2026-10', '', '')).toEqual({
    start: '2026-04-01',
    end: '2026-06-30',
  });
  expect(periodRange('semester2', '2026-10', '', '')).toEqual({
    start: '2026-07-01',
    end: '2026-12-31',
  });
  expect(periodRange('year', '2026-10', '', '')).toEqual({
    start: '2026-01-01',
    end: '2026-12-31',
  });
  expect(periodRange('3', today().slice(0, 7), '', '').end).toBe(today());
});
