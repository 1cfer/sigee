import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
const pdf = () => {
  const doc = new jsPDF();
  doc.text('Documento PDF propio de demostracion', 20, 30);
  return Buffer.from(doc.output('arraybuffer'));
};

test('instalación y activo nuevos conservan relaciones, edición e historial', async ({ page }) => {
  await page.goto('/activos?vista=instalaciones');
  await page.getByRole('button', { name: 'Crear instalación', exact: true }).click();
  await page.getByLabel('Código *', { exact: true }).fill('INS-E2E');
  await page.getByLabel('Nombre').fill('Instalación de prueba E2E');
  await page.getByLabel('Ubicación general').fill('Ubicación ficticia');
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('INS-E2E');
  await page.getByRole('button', { name: 'Cerrar diálogo', exact: true }).click();
  await page.goto('/activos');
  await page.getByRole('button', { name: 'Registrar activo', exact: true }).click();
  await page.getByLabel('Código *', { exact: true }).fill('ACT-E2E');
  await page.getByLabel('Nombre').fill('Activo de prueba E2E');
  await page
    .getByRole('dialog')
    .getByLabel('Instalación *', { exact: true })
    .selectOption({ label: 'INS-E2E · Instalación de prueba E2E' });
  await page.getByLabel('Tipo de equipo').fill('Tablero ficticio');
  await page.getByLabel('Tensión nominal declarada').fill('480 V');
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await page.getByRole('link', { name: 'Activo de prueba E2E', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Activo de prueba E2E', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Editar activo', exact: true }).click();
  await page.getByLabel('Estado operativo declarado').selectOption('registrado fuera de servicio');
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).click();
  await page.reload();
  await expect(page.getByText('registrado fuera de servicio', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Archivar registro', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText('Archivado', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Registro archivado; conserva relaciones e historial.', { exact: false }),
  ).toBeVisible();
});

test('recorrido estrella: estudio PDF → hallazgo → alerta → indicador → cierre → informe → persistencia', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/dashboard');
  await expect(page.getByTestId('metric-open')).toBeVisible();
  const initialOpen = Number(await page.getByTestId('metric-open').innerText()),
    initialHigh = Number(await page.getByTestId('metric-high').innerText());
  await page.goto('/estudios-documentos?tipo=estudios&registro=study-1');
  await page.getByRole('button', { name: 'Archivos y PDF', exact: true }).click();
  await page.getByRole('button', { name: 'Visualizar', exact: true }).click();
  await expect(page.locator('iframe')).toBeVisible();
  const source = await page.locator('iframe').getAttribute('src');
  expect(source).toMatch(/^blob:/);
  expect(
    await page.evaluate(
      async (url) => (await (await fetch(url!)).text()).startsWith('%PDF-'),
      source,
    ),
  ).toBe(true);
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: 'Cerrar diálogo', exact: true })
    .click();
  await page.goto('/activos/asset-1');
  await page.getByRole('button', { name: 'Crear hallazgo', exact: true }).click();
  await expect(page.getByLabel('Activo asociado')).toHaveValue('asset-1');
  await page.getByLabel('Título *', { exact: true }).fill('Observación de demostración V2');
  await page.getByLabel('Prioridad').selectOption('alta');
  await page.getByLabel('Responsable', { exact: false }).fill('Responsable demo E2E');
  await page.getByRole('button', { name: 'Guardar hallazgo' }).click();
  await expect(page.getByRole('status')).toContainText('Hallazgo creado');
  await page.goto('/dashboard');
  await expect(page.getByTestId('metric-open')).toHaveText(
    String(initialOpen + 1).padStart(2, '0'),
  );
  await expect(page.getByTestId('metric-high')).toHaveText(
    String(initialHigh + 1).padStart(2, '0'),
  );
  await page
    .getByRole('button', { name: /Prioridad alta/ })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toContainText('Observación de demostración V2');
  await expect(page.getByRole('dialog').locator('tbody tr')).toHaveCount(initialHigh + 1);
  await page.getByRole('button', { name: 'Cerrar diálogo', exact: true }).click();
  await page.goto('/alertas');
  await page.getByRole('link', { name: 'Observación de demostración V2', exact: true }).click();
  await page.getByRole('button', { name: 'Editar hallazgo', exact: true }).click();
  await page.getByLabel('Estado *', { exact: true }).selectOption('cerrado');
  await page.getByRole('button', { name: 'Guardar hallazgo' }).click();
  await expect(page.getByRole('alert')).toContainText('justificación');
  await page.getByLabel('Acción correctiva').fill('Seguimiento documental de prueba');
  await page
    .getByLabel('Justificación del cierre')
    .fill('Comprobación ficticia registrada en la demostración');
  await page.getByRole('button', { name: 'Guardar hallazgo' }).click();
  await expect(page.getByRole('dialog')).toContainText('cerrado');
  await page.getByLabel('Añadir comentario').fill('Comentario persistente de V2');
  await page.getByRole('button', { name: 'Registrar comentario' }).click();
  await page.reload();
  await expect(page.getByRole('dialog')).toContainText('Comentario persistente de V2');
  await page.goto('/alertas');
  await expect(
    page.getByRole('link', { name: 'Observación de demostración V2', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Estado de alerta').selectOption('resuelta');
  await expect(
    page.getByRole('link', { name: 'Observación de demostración V2', exact: true }),
  ).toBeVisible();
  await page.goto('/dashboard');
  await expect(page.getByTestId('metric-open')).toHaveText(String(initialOpen).padStart(2, '0'));
  await page.getByRole('button', { name: 'Generar informe', exact: true }).click();
  let download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar informe' }).click();
  const report = await download;
  expect(report.suggestedFilename()).toMatch(/\.pdf$/);
  const bytes = await readFile((await report.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.toString('latin1')).toContain('Observaci');
  await page.getByLabel('Formato de informe').selectOption('xlsx');
  download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar informe' }).click();
  const excel = await download;
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile((await excel.path())!);
  expect(book.worksheets).toHaveLength(10);
  const titles = book.getWorksheet('Hallazgos')!.getColumn(4).values;
  expect(titles).toContain('Observación de demostración V2');
  expect(errors).toEqual([]);
});

test('documento propio, versiones y revisión formal persisten tras recargar', async ({ page }) => {
  await page.goto('/estudios-documentos?tipo=documentos');
  await page.getByRole('button', { name: 'Crear documento', exact: true }).click();
  await page.getByLabel('Código *', { exact: true }).fill('DOC-E2E');
  await page.getByLabel('Título *', { exact: true }).fill('Documento propio E2E');
  await page.getByLabel('Categoría documental').fill('Procedimiento');
  await page.getByLabel('Activo asociado').selectOption('asset-1');
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await page.getByRole('button', { name: 'Archivos y PDF', exact: true }).click();
  await page.getByText('Adjuntar PDF / nueva versión', { exact: true }).click();
  await page
    .getByLabel('Archivo *', { exact: true })
    .setInputFiles({ name: 'documento-propio.pdf', mimeType: 'application/pdf', buffer: pdf() });
  await page.getByLabel('Versión del archivo').fill('2.0');
  await page.getByRole('button', { name: 'Guardar archivo' }).click();
  await expect(page.getByText('documento-propio.pdf', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Revisiones', exact: true }).click();
  await page.getByRole('button', { name: 'Registrar revisión', exact: true }).click();
  await page.getByLabel('Responsable de revisión').fill('Revisor de prueba');
  await page.getByLabel('Alcance y observaciones').fill('Comprobación del contenido documental');
  await page.getByRole('dialog').last().getByLabel('Próxima revisión').fill('2099-12-31');
  await page.getByRole('button', { name: 'Guardar revisión' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Revisiones', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Revisor de prueba · Versión 2.0');
  await page.getByRole('button', { name: 'Archivos y PDF', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('documento-propio.pdf');
  await page.getByRole('button', { name: 'Visualizar', exact: true }).click();
  await expect(page.locator('iframe')).toBeVisible();
});

test('EPP: nuevas referencias, entradas, inspecciones, asignación y devolución con motivo', async ({
  page,
}) => {
  await page.goto('/epp');
  await page.getByRole('button', { name: 'Crear referencia EPP', exact: true }).click();
  await page.getByLabel('Código *', { exact: true }).fill('EPP-E2E');
  await page.getByLabel('Tipo de EPP').fill('Referencia de prueba');
  await page.getByLabel('Referencia *', { exact: true }).fill('REF-E2E');
  await page.getByLabel('Categoría *', { exact: true }).fill('Demostración');
  await page.getByLabel('Ubicación de almacenamiento').fill('Almacén ficticio');
  await page.getByLabel('Unidades recibidas').fill('2');
  await page.getByRole('button', { name: 'Guardar registro' }).click();
  await expect(page.getByTestId('balance-Disponibles')).toHaveText('0');
  await expect(page.getByTestId('balance-No disponibles')).toHaveText('2');
  await page.getByRole('button', { name: 'Movimientos', exact: true }).click();
  await page.getByLabel('Tipo de movimiento').selectOption('entrada');
  await page.getByLabel('Unidades del movimiento').fill('3');
  await page.getByLabel('Responsable del movimiento').fill('Responsable demo');
  await page.getByLabel('Procedencia o referencia').fill('Proveedor ficticio');
  await page.getByLabel('Motivo y observaciones').fill('Recepción de demostración');
  await page.getByRole('button', { name: 'Guardar movimiento' }).click();
  await expect(page.getByTestId('balance-Total')).toHaveText('5');
  await expect(page.getByTestId('balance-Disponibles')).toHaveText('0');
  await page.getByLabel('Tipo de movimiento').selectOption('inspección');
  await page.getByLabel('Estado de origen').selectOption('pendiente de inspección');
  await page.getByLabel('Estado de destino').selectOption('disponible');
  await page.getByRole('button', { name: 'Guardar movimiento' }).click();
  await expect(page.getByTestId('balance-Disponibles')).toHaveText('3');
  await page.getByRole('button', { name: 'Asignaciones', exact: true }).click();
  await page.getByLabel('Activo de destino').selectOption('asset-1');
  await page.getByLabel('Unidades a asignar').fill('2');
  await page.getByLabel('Responsable de asignación').fill('Responsable demo');
  await page.getByLabel('Actividad *', { exact: true }).fill('Demostración de trazabilidad');
  await page.getByRole('button', { name: 'Asignar unidades', exact: true }).click();
  await expect(page.getByTestId('balance-Disponibles')).toHaveText('1');
  await page.getByLabel('Estado de recepción').selectOption('en cuarentena');
  await page.getByRole('button', { name: 'Registrar devolución', exact: true }).click();
  await expect(page.getByTestId('balance-Asignadas')).toHaveText('0');
  await expect(page.getByTestId('balance-No disponibles')).toHaveText('4');
  await page.reload();
  await page.getByRole('button', { name: 'Consulta', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('en cuarentena');
  await expect(page.getByTestId('balance-Disponibles')).toHaveText('1');
});

test('borradores, búsqueda global, filtros, preferencias y restauración confirmada', async ({
  page,
}) => {
  await page.goto('/estudios-documentos?tipo=documentos&registro=doc-1');
  await page.getByRole('button', { name: 'Editar metadatos' }).click();
  await page.getByLabel('Título *', { exact: true }).fill('Borrador sin guardar');
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: 'Cerrar diálogo', exact: true })
    .click();
  await expect(page.getByText('Hay cambios sin guardar.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  await expect(page.getByLabel('Título *', { exact: true })).toHaveValue('Borrador sin guardar');
  await page
    .getByRole('dialog')
    .last()
    .getByRole('button', { name: 'Cerrar diálogo', exact: true })
    .click();
  await page.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  await page.getByRole('button', { name: 'Cerrar diálogo', exact: true }).click();
  await page.getByRole('button', { name: 'Buscar en SIGEE' }).click();
  await page
    .getByRole('textbox', { name: 'Código, nombre, activo o instalación…' })
    .fill('ACT-001');
  await page
    .getByRole('dialog')
    .getByRole('link', { name: /ACT-001 Tablero/ })
    .click();
  await expect(page).toHaveURL(/activos\/asset-1/);
  await page.goto('/dashboard');
  await page.getByLabel('Período', { exact: true }).selectOption('year');
  await page.getByLabel('Instalación', { exact: true }).selectOption('inst-1');
  await page.getByRole('button', { name: /Activos registrados/ }).click();
  await expect(page.getByRole('dialog').locator('tbody tr')).toHaveCount(4);
  await page.getByRole('button', { name: 'Cerrar diálogo', exact: true }).click();
  await page.getByRole('button', { name: 'Vista cómoda', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Vista compacta', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Restaurar datos de demostración', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Restaurar datos de demostración', exact: true }).click();
  await page.getByRole('button', { name: 'Restaurar datos', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('restaurados');
});

test('accesibilidad en seis módulos y fichas de consulta', async ({ page }) => {
  test.setTimeout(90000);
  for (const route of [
    '/dashboard',
    '/activos',
    '/hallazgos',
    '/epp',
    '/estudios-documentos',
    '/alertas',
    '/hallazgos?registro=finding-1',
    '/epp?registro=ppe-1',
    '/estudios-documentos?tipo=estudios&registro=study-1',
  ]) {
    await page.goto(route);
    await page.locator('main').waitFor();
    if (route.includes('registro=')) await page.getByRole('dialog').waitFor();
    else await page.getByRole('heading', { level: 1 }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations, route).toEqual([]);
  }
});

test('revisión responsive, navegación móvil y capturas de los módulos', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const route of [
    '/dashboard',
    '/activos',
    '/hallazgos',
    '/epp',
    '/estudios-documentos',
    '/alertas',
  ]) {
    await page.goto(route);
    await page.locator('main').waitFor();
    await page.getByRole('heading', { level: 1 }).waitFor();
    await page.screenshot({ path: `test-results/v2-${route.slice(1)}.png`, fullPage: true });
  }
  await page.goto('/dashboard');
  await page.setViewportSize({ width: 900, height: 1100 });
  await expect(page.getByTestId('metric-open')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/v2-tablet.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /Hallazgos/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Hallazgos', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto('/estudios-documentos?tipo=estudios&registro=study-1');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/v2-estudio-movil.png', fullPage: true });
  expect(errors).toEqual([]);
});
