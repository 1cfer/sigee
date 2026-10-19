import { openDB, type DBSchema } from 'idb';
import { createDemoDatabase } from '../domain/seed';
import { upgradeDatabase } from '../domain/migration';
import { assertIntegrity } from '../domain/validation';
import { assertIntegrity as assertLegacy } from '../domain/legacy-validation';
import type { DatabaseV2 } from '../domain/v2';
import type { DemoDatabase } from '../domain/types';
interface Storage extends DBSchema {
  kv: { key: string; value: unknown };
  files: { key: string; value: Blob };
}
export const STORAGE_KEY = 'sigee-demo';
export const STORAGE_VERSION = 2;
const connection = () =>
  openDB<Storage>('sigee-v2', 1, {
    upgrade(db) {
      db.createObjectStore('kv');
      db.createObjectStore('files');
    },
  });
let notice = '';
export const getRecoveryNotice = () => notice;
export async function readDatabase(): Promise<DatabaseV2> {
  const storage = await connection();
  try {
    const current = await storage.get('kv', 'database');
    if (current) {
      try {
        assertIntegrity(current as DatabaseV2);
        return current as DatabaseV2;
      } catch {
        await storage.put(
          'kv',
          { data: current, at: new Date().toISOString() },
          'v2-recovery-backup',
        );
        const demo = createDemoDatabase();
        await storage.put('kv', demo, 'database');
        notice =
          'Los datos V2 no superaron la validación. Se conservó un respaldo y se recuperó la demostración. Los archivos anteriores siguen en IndexedDB.';
        return demo;
      }
    }
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      notice = 'No se pudo leer localStorage. V2 utilizará IndexedDB.';
    }
    let data = createDemoDatabase();
    if (raw) {
      await storage.put('kv', { raw, at: new Date().toISOString() }, 'v1-backup');
      try {
        const envelope: unknown = JSON.parse(raw);
        if ((envelope as { version?: number }).version !== 1)
          throw new Error('Versión V1 incompatible');
        const legacy = (envelope as { state?: { db?: DemoDatabase } })?.state?.db;
        if (!legacy) throw new Error('Formato V1 desconocido');
        assertLegacy(legacy);
        data = upgradeDatabase(legacy);
        notice = 'Datos V1 migrados. El respaldo original se conserva, sin modificar localStorage.';
      } catch {
        notice =
          'No se pudo interpretar V1. Se conservó un respaldo íntegro y se inició la demostración V2.';
      }
    }
    assertIntegrity(data);
    await storage.put('kv', data, 'database');
    return data;
  } finally {
    storage.close();
  }
}
export async function writeDatabase(
  data: DatabaseV2,
  files: { id: string; blob: Blob }[] = [],
  resetFiles = false,
) {
  assertIntegrity(data);
  const storage = await connection();
  try {
    const currentBytes = data.attachments.reduce((s, a) => s + a.size, 0);
    if (currentBytes > 50 * 1024 * 1024)
      throw new Error(
        'El límite de archivos de esta demostración es 50 MB. No se guardó la operación.',
      );
    const tx = storage.transaction(['kv', 'files'], 'readwrite');
    try {
      const previous = (await tx.objectStore('kv').get('database')) as DatabaseV2 | undefined;
      if ((previous?.revision ?? 0) !== (data.revision ?? 0))
        throw new Error(
          'Otra pestaña actualizó los datos. Recarga SIGEE antes de guardar; esta operación no se aplicó.',
        );
      const revision = (data.revision ?? 0) + 1;
      if (resetFiles) await tx.objectStore('files').clear();
      for (const file of files) await tx.objectStore('files').put(file.blob, file.id);
      await tx.objectStore('kv').put({ ...data, revision }, 'database');
      await tx.done;
      data.revision = revision;
    } catch (e) {
      try {
        tx.abort();
      } catch {
        /* Ya finalizada. */
      }
      await tx.done.catch(() => {});
      throw e;
    }
  } catch (error) {
    if (
      error instanceof DOMException &&
      ['QuotaExceededError', 'UnknownError'].includes(error.name)
    )
      throw new Error('No hay espacio disponible. El archivo y los metadatos no se guardaron.');
    throw error;
  } finally {
    storage.close();
  }
}
export async function readFile(id: string) {
  const storage = await connection();
  try {
    const blob = await storage.get('files', id);
    if (!blob) throw new Error('El archivo no está disponible en este navegador.');
    return blob;
  } finally {
    storage.close();
  }
}
export async function validateFile(file: File, images = false) {
  const allowed = images ? ['application/pdf', 'image/png', 'image/jpeg'] : ['application/pdf'];
  if (!allowed.includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024)
    throw new Error(
      'Selecciona un PDF válido de hasta 10 MB' + (images ? ', o una imagen PNG/JPEG.' : '.'),
    );
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const valid =
    file.type === 'application/pdf'
      ? new TextDecoder().decode(bytes).startsWith('%PDF-')
      : file.type === 'image/png'
        ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78
        : bytes[0] === 255 && bytes[1] === 216;
  if (!valid) throw new Error('El contenido del archivo no coincide con su tipo.');
}
