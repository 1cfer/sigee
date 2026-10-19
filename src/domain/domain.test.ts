import { describe, expect, it } from 'vitest';
import { createDemoDatabase, DEMO_DATE } from './seed';
import { assetReviewPending, deriveAlerts, selectCharts, selectMetrics } from './selectors';
import { assertIntegrity, findingSchema, validateInventory } from './validation';
import { calendarDate, displayDate } from './dates';

it('conserva el día de Bogotá al cruzar medianoche UTC', () => {
  expect(calendarDate('2026-10-17T01:00:00.000Z')).toBe('2026-10-16');
  expect(displayDate('2026-10-17T01:00:00.000Z')).toBe('16 oct 2026');
});

describe('Dataset e integridad referencial', () => {
  it('incluye las cantidades solicitadas y referencias válidas', () => {
    const db = createDemoDatabase();
    expect([
      db.installations.length,
      db.assets.length,
      db.findings.length,
      db.ppe.length,
      db.studies.length,
      db.documents.length,
    ]).toEqual([3, 10, 14, 12, 10, 15]);
    expect(db.findingEvents.length).toBeGreaterThanOrEqual(8);
    expect(() => assertIntegrity(db)).not.toThrow();
    expect(createDemoDatabase()).toEqual(db);
  });
  it('rechaza relaciones inexistentes, IDs duplicados y fechas inconsistentes', () => {
    const db = createDemoDatabase();
    db.findings[0]!.assetId = 'inexistente';
    expect(() => assertIntegrity(db)).toThrow();
    const duplicate = createDemoDatabase();
    duplicate.assets.push(duplicate.assets[0]!);
    expect(() => assertIntegrity(duplicate)).toThrow('duplicados');
    const inconsistent = createDemoDatabase();
    inconsistent.findings[0]!.status = 'cerrado';
    expect(() => assertIntegrity(inconsistent)).toThrow();
  });
  it('no acepta fechas imposibles ni texto vacío', () => {
    const input = createDemoDatabase().findings[0]!;
    expect(findingSchema.safeParse({ ...input, dueDate: '2026-02-30' }).success).toBe(false);
    expect(findingSchema.safeParse({ ...input, title: '   ' }).success).toBe(false);
  });
});

describe('Indicadores y gráficas derivados', () => {
  it('cuenta abiertos, prioridad alta y vencidos excluyendo los cerrados', () => {
    const db = createDemoDatabase();
    const metrics = selectMetrics(db, DEMO_DATE);
    expect(metrics).toEqual({
      assets: 10,
      open: 11,
      high: 4,
      overdue: 4,
      inspections: 3,
      reviews: 5,
    });
    const charts = selectCharts(db, DEMO_DATE);
    expect(charts.priorities).toEqual([
      { name: 'alta', value: 4 },
      { name: 'media', value: 4 },
      { name: 'baja', value: 3 },
    ]);
    expect(charts.statuses.reduce((sum, s) => sum + s.value, 0)).toBe(14);
    expect(charts.installations.reduce((sum, s) => sum + s.value, 0)).toBe(metrics.open);
    expect(charts.trend.reduce((sum, s) => sum + s.creados, 0)).toBe(14);
    expect(charts.trend.reduce((sum, s) => sum + s.cerrados, 0)).toBe(3);
  });
  it('incluye activos sin pendientes documentales', () => {
    const db = createDemoDatabase();
    expect(assetReviewPending(db, 'asset-1', DEMO_DATE)).toBe(true);
    expect(assetReviewPending(db, 'asset-10', DEMO_DATE)).toBe(false);
    expect(db.findings.filter((f) => f.assetId === 'asset-10')).toHaveLength(0);
  });
});

describe('Motor determinístico de alertas', () => {
  it('aplica R1–R4 con identificadores estables y sin duplicados', () => {
    const db = createDemoDatabase();
    const alerts = deriveAlerts(db, DEMO_DATE);
    expect(alerts).toHaveLength(16);
    expect(new Set(alerts.map((a) => a.id)).size).toBe(alerts.length);
    expect(deriveAlerts(db, DEMO_DATE)).toEqual(alerts);
    expect(alerts.some((a) => a.id === 'R1:finding-1')).toBe(true);
    expect(alerts.some((a) => a.id === 'R2:finding-1')).toBe(true);
    expect(alerts.some((a) => a.id === 'R3:ppe-1')).toBe(true);
    expect(alerts.some((a) => a.id === 'R4:estudio:study-1')).toBe(true);
    expect(alerts.some((a) => a.id === 'R4:documento:doc-1')).toBe(true);
  });
  it('elimina R1 y R2 al cerrar un hallazgo', () => {
    const db = createDemoDatabase();
    db.findings[0] = {
      ...db.findings[0]!,
      status: 'cerrado',
      closedAt: `${DEMO_DATE}T15:00:00.000Z`,
    };
    expect(deriveAlerts(db, DEMO_DATE).filter((a) => a.sourceId === 'finding-1')).toHaveLength(0);
    expect(selectMetrics(db, DEMO_DATE).open).toBe(10);
    expect(selectMetrics(db, DEMO_DATE).high).toBe(3);
  });
  it('la fecha de hoy no se considera vencida', () => {
    const db = createDemoDatabase();
    db.findings[0]!.dueDate = DEMO_DATE;
    db.ppe[0]!.nextInspection = DEMO_DATE;
    db.ppe[0]!.inspectionStatus = 'registrada';
    expect(deriveAlerts(db, DEMO_DATE).some((a) => a.id === 'R2:finding-1')).toBe(false);
    expect(deriveAlerts(db, DEMO_DATE).some((a) => a.id === 'R3:ppe-1')).toBe(false);
  });
});

describe('Inventario', () => {
  it('incluye asignadas en la ecuación y bloquea cantidades negativas o fraccionarias', () => {
    const ppe = createDemoDatabase().ppe[0]!;
    expect(validateInventory(ppe, 1)).toBe(true);
    expect(validateInventory(ppe, 0)).toBe(false);
    expect(validateInventory({ ...ppe, available: -1 }, 1)).toBe(false);
    expect(validateInventory({ ...ppe, total: 8.5 }, 1)).toBe(false);
  });
});
