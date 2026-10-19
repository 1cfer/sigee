import { beforeEach, expect, it } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { createDemoDatabase } from '../domain/seed';
import { readDatabase, writeDatabase, getRecoveryNotice, validateFile } from './database';
import { File as NodeFile } from 'node:buffer';
beforeEach(async () => {
  await deleteDB('sigee-v2');
  localStorage.clear();
});
it('rechaza una escritura desde una pestaña desactualizada en lugar de perder cambios', async () => {
  const first = await readDatabase(),
    stale = await readDatabase();
  first.findings[0]!.title = 'Cambio confirmado';
  await writeDatabase(first);
  stale.findings[0]!.title = 'Cambio obsoleto';
  await expect(writeDatabase(stale)).rejects.toThrow('Otra pestaña');
  expect((await readDatabase()).findings[0]!.title).toBe('Cambio confirmado');
});
it('migra V1 sin modificar el original y conserva su respaldo', async () => {
  const v2 = createDemoDatabase();
  const legacy = {
    installations: v2.installations,
    assets: v2.assets,
    findings: v2.findings,
    findingEvents: v2.findingEvents,
    ppe: v2.ppe,
    assignments: v2.assignments,
    studies: v2.studies,
    documents: v2.documents,
  };
  const raw = JSON.stringify({ version: 1, state: { db: legacy } });
  localStorage.setItem('sigee-demo', raw);
  const db = await readDatabase();
  expect(db.schemaVersion).toBe(2);
  expect(db.findings.map((f) => f.id)).toEqual(legacy.findings.map((f) => f.id));
  expect(localStorage.getItem('sigee-demo')).toBe(raw);
  const storage = await openDB('sigee-v2', 1);
  expect((await storage.get('kv', 'v1-backup')).raw).toBe(raw);
  storage.close();
});
it('respalda V1 corrupto y recupera V2 dañado sin perder el respaldo', async () => {
  localStorage.setItem('sigee-demo', '{roto');
  await readDatabase();
  expect(getRecoveryNotice()).toContain('respaldo');
  const storage = await openDB('sigee-v2', 1);
  await storage.put('kv', { schemaVersion: 2, findings: [] }, 'database');
  storage.close();
  const db = await readDatabase();
  expect(db.findings).toHaveLength(14);
  const recovered = await openDB('sigee-v2', 1);
  expect(await recovered.get('kv', 'v2-recovery-backup')).toBeTruthy();
  expect((await recovered.get('kv', 'v1-backup')).raw).toBe('{roto');
  recovered.close();
});
it('valida tipo, contenido, tamaño y límite total sin escribir metadatos', async () => {
  const file = (body: string, type: string) =>
    new NodeFile([body], 'prueba.pdf', { type }) as unknown as File;
  await expect(validateFile(file('contenido falso', 'application/pdf'))).rejects.toThrow(
    'contenido',
  );
  await expect(validateFile(file('%PDF-1.7', 'text/html'))).rejects.toThrow('PDF');
  await expect(
    validateFile(
      new NodeFile([new Uint8Array(11 * 1024 * 1024)], 'grande.pdf', {
        type: 'application/pdf',
      }) as unknown as File,
    ),
  ).rejects.toThrow('10 MB');
  const db = await readDatabase();
  db.attachments.push({
    id: 'file',
    entityType: 'document',
    entityId: 'doc-1',
    name: 'grande.pdf',
    mime: 'application/pdf',
    size: 51 * 1024 * 1024,
    uploadedAt: new Date().toISOString(),
    version: '1',
    notes: '',
  });
  await expect(writeDatabase(db)).rejects.toThrow('50 MB');
  expect((await readDatabase()).attachments).toHaveLength(0);
});
