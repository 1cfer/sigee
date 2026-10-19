import { beforeEach, describe, expect, it, vi } from 'vitest';
import { File as NodeFile } from 'node:buffer';
import { useDatabase } from './useDatabase';
import { assertIntegrity } from '../domain/validation';
import { deriveAlerts, selectMetrics } from '../domain/selectors';
import { inventoryReasons } from '../domain/analysis';
import { readDatabase, readFile } from '../persistence/database';
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
beforeEach(async () => {
  await useDatabase.getState().initialize();
  await useDatabase.getState().reset();
});
describe('Transacciones V2 y persistencia real', () => {
  it('registra una reinspección sin cambiar el saldo y permite programar su siguiente fecha', async () => {
    const s = useDatabase.getState(),
      available = s.db.ppe[0]!.available;
    await s.movePPE('ppe-1', {
      type: 'inspección',
      quantity: 2,
      from: 'disponible',
      to: 'disponible',
      responsible: 'Responsable demo',
      source: 'Registro de inspección',
      notes: 'Reinspección administrativa simulada',
      date: today(),
      nextInspection: '2099-12-31',
    });
    expect(useDatabase.getState().db.ppe[0]).toMatchObject({
      available,
      lastInspection: today(),
      nextInspection: '2099-12-31',
    });
    expect(deriveAlerts(useDatabase.getState().db).some((a) => a.sourceId === 'ppe-1')).toBe(false);
  });
  it('crea, exige cierre justificado, conserva historial al reabrir y archivar', async () => {
    const s = useDatabase.getState(),
      initial = selectMetrics(s.db).open,
      id = await s.saveFinding(input());
    expect(selectMetrics(useDatabase.getState().db).open).toBe(initial + 1);
    await expect(s.saveFinding({ ...input(), status: 'cerrado' }, id)).rejects.toThrow(
      'justificación',
    );
    await s.saveFinding(
      {
        ...input(),
        status: 'cerrado',
        correctiveAction: 'Revisión ficticia',
        closureJustification: 'Justificación de demostración',
        responsible: 'Otra persona',
      },
      id,
    );
    expect(useDatabase.getState().db.findings.find((f) => f.id === id)?.closedBy).toBe(
      'Otra persona',
    );
    expect(deriveAlerts(useDatabase.getState().db).some((a) => a.sourceId === id)).toBe(false);
    await s.saveFinding(input(), id);
    await s.addComment(id, 'Seguimiento ficticio.');
    await s.removeFinding(id);
    const db = await readDatabase();
    expect(db.findings.find((f) => f.id === id)).toMatchObject({
      archived: true,
      status: 'abierto',
      closedAt: undefined,
    });
    expect(db.findingEvents.filter((e) => e.findingId === id).length).toBeGreaterThanOrEqual(4);
    expect(() => assertIntegrity(db)).not.toThrow();
  });
  it('bloquea referencias y fechas inválidas sin publicar estado', async () => {
    const s = useDatabase.getState(),
      before = s.db;
    await expect(s.saveFinding({ ...input(), assetId: 'inexistente' })).rejects.toThrow();
    await expect(s.saveFinding({ ...input(), dueDate: '2000-01-01' })).rejects.toThrow();
    expect(useDatabase.getState().db).toBe(before);
  });
  it('recibe no disponible, inspecciona, asigna y devuelve sin borrar la asignación', async () => {
    const s = useDatabase.getState(),
      available = s.db.ppe[0]!.available;
    await expect(s.assignPPE('ppe-1', 'asset-1', available + 1)).rejects.toThrow();
    await expect(s.assignPPE('ppe-1', 'inexistente', 1)).rejects.toThrow();
    const movement = {
      type: 'entrada' as const,
      quantity: 3,
      from: 'disponible' as const,
      to: 'pendiente de inspección' as const,
      responsible: 'Demo',
      source: 'Proveedor simulado',
      notes: 'Entrada de prueba',
      date: today(),
    };
    await s.movePPE('ppe-1', movement);
    expect(useDatabase.getState().db.ppe[0]!.available).toBe(available);
    await s.movePPE('ppe-1', {
      ...movement,
      type: 'inspección',
      from: 'pendiente de inspección',
      to: 'disponible',
    });
    await s.assignPPE('ppe-1', 'asset-1', 2, { responsible: 'Demo', activity: 'Prueba' });
    const assignment = useDatabase.getState().db.assignments.at(-1)!;
    await s.releaseAssignment(assignment.id, 'en cuarentena');
    const db = await readDatabase();
    expect(db.assignments.find((a) => a.id === assignment.id)?.returnedAt).toBeTruthy();
    expect(inventoryReasons(db, 'ppe-1')['en cuarentena']).toBe(2);
    expect(db.ppe[0]!.available).toBe(available + 1);
    await expect(s.releaseAssignment(assignment.id)).rejects.toThrow();
    await expect(
      s.movePPE('ppe-1', {
        ...movement,
        type: 'inspección',
        quantity: 999,
        from: 'en cuarentena',
        to: 'disponible',
      }),
    ).rejects.toThrow();
    expect(() => assertIntegrity(useDatabase.getState().db)).not.toThrow();
  });
  it('guarda PDF y versiones atómicamente y mantiene independiente la revisión', async () => {
    const s = useDatabase.getState(),
      file = new NodeFile(['%PDF-1.7\ncontenido de prueba'], 'revision.pdf', {
        type: 'application/pdf',
      }) as unknown as File;
    await s.upload('document', 'doc-1', file, '2.0', 'Segunda versión');
    let db = await readDatabase();
    const attachment = db.attachments.find((a) => a.entityId === 'doc-1' && a.version === '2.0')!;
    expect(await (await readFile(attachment.id)).text()).toContain('%PDF');
    expect(db.documents[0]!.lastReviewedAt).toBeUndefined();
    await expect(s.upload('document', 'doc-1', file, '2.0', 'Repetida')).rejects.toThrow('versión');
    await s.review('document', 'doc-1', {
      date: today(),
      responsible: 'Revisor demo',
      notes: 'Revisión administrativa',
      nextReview: '2099-12-31',
    });
    db = await readDatabase();
    expect(db.reviews.at(-1)?.version).toBe('2.0');
    expect(db.documents[0]!.lastReviewedAt).toBe(today());
    expect(db.versions.filter((v) => v.entityId === 'doc-1')).toHaveLength(3);
  });
  it('no muestra guardado si IndexedDB rechaza la transacción', async () => {
    const s = useDatabase.getState(),
      before = s.db;
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('Cuota agotada', 'QuotaExceededError');
    });
    await expect(s.saveFinding(input())).rejects.toThrow('espacio');
    put.mockRestore();
    expect(useDatabase.getState().db).toBe(before);
    expect((await readDatabase()).findings).toHaveLength(before.findings.length);
  });
  it('registra el reconocimiento y solo resuelve al desaparecer la condición', async () => {
    const s = useDatabase.getState(),
      id = await s.saveFinding(input());
    const alert = useDatabase.getState().db.alertHistory.find((a) => a.sourceId === id)!;
    await s.acknowledge(alert.id);
    expect(useDatabase.getState().db.alertHistory.find((a) => a.id === alert.id)?.status).toBe(
      'reconocida',
    );
    await s.saveFinding(
      {
        ...input(),
        status: 'cerrado',
        correctiveAction: 'Acción demo',
        closureJustification: 'Cierre demo',
      },
      id,
    );
    expect(useDatabase.getState().db.alertHistory.find((a) => a.id === alert.id)).toMatchObject({
      status: 'resuelta',
    });
    await s.refreshAlerts();
    const alerts = useDatabase.getState().db.alertHistory;
    expect(new Set(alerts.map((a) => a.id)).size).toBe(alerts.length);
  });
  it('crea instalación y activo, preserva relaciones al desactivar y audita valores anteriores', async () => {
    const s = useDatabase.getState(),
      id = await s.saveRecord('installation', {
        code: 'INS-TEST',
        name: 'Instalación de prueba',
        location: 'Ubicación ficticia',
        description: 'Demo',
        responsible: 'Demo',
      });
    const asset = await s.saveRecord('asset', {
      code: 'ACT-TEST',
      name: 'Activo de prueba',
      installationId: id,
      type: 'Tablero',
      nominalVoltage: '480 V',
      administrativeStatus: 'registrado',
      operationalStatus: 'sin verificar',
      description: 'Demo',
      responsible: 'Demo',
    });
    await s.saveRecord(
      'installation',
      {
        code: 'INS-TEST',
        name: 'Nombre actualizado',
        location: 'Ubicación ficticia',
        description: 'Demo',
        responsible: 'Demo',
      },
      id,
    );
    await s.archive('installation', id);
    const db = await readDatabase();
    expect(db.assets.find((a) => a.id === asset)?.installationId).toBe(id);
    expect(db.events.find((e) => e.entityId === id && e.action === 'edición')?.before?.name).toBe(
      'Instalación de prueba',
    );
    expect(() => assertIntegrity(db)).not.toThrow();
  });
  it('restaura registros y archivos con confirmación gestionada por la interfaz', async () => {
    const s = useDatabase.getState();
    await s.saveFinding(input());
    await s.reset();
    const db = await readDatabase();
    expect(db.findings).toHaveLength(14);
    expect(db.attachments).toHaveLength(6);
    expect(db.attachments.every((a) => a.name.endsWith('.pdf'))).toBe(true);
  });
});
