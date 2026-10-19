// @vitest-environment node
import { expect, it } from 'vitest';
import { Workbook } from 'exceljs';
import { createDemoDatabase } from '../domain/seed';
import { analyze, defaultFilters } from '../domain/analysis';
import { createReportPDF, createStudyPDF, REPORT_SECTIONS } from './pdf';
import { createExcel } from './excel';
it('genera un PDF real con varias páginas y contenido del registro', async () => {
  const db = createDemoDatabase();
  db.studies[0]!.title = 'Estudio documental editado';
  const blob = await createStudyPDF(db, 'study-1');
  const text = await blob.text();
  expect(text.startsWith('%PDF-')).toBe(true);
  expect(text.match(/\/Type \/Page\b/g)?.length).toBeGreaterThanOrEqual(4);
  expect(text).toContain('Estudio documental editado');
  const report = await createReportPDF(db, {
    ...defaultFilters(),
    period: 'all',
    start: '1900-01-01',
    end: '2999-12-31',
  });
  expect((await report.text()).match(/\/Type \/Page\b/g)?.length).toBeGreaterThanOrEqual(8);
});
it('el Excel contiene diez hojas, fechas reales y exactamente la selección filtrada', async () => {
  const db = createDemoDatabase(),
    filters = {
      ...defaultFilters(),
      period: 'all',
      start: '1900-01-01',
      end: '2999-12-31',
      installationId: db.installations[0]!.id,
      priority: 'alta',
    };
  db.findings[0]!.title = 'Título cambiado durante la sesión';
  const blob = await createExcel(db, filters, [...REPORT_SECTIONS]);
  const book = new Workbook();
  await book.xlsx.load(await blob.arrayBuffer());
  expect(book.worksheets.map((s) => s.name)).toEqual([
    'Resumen',
    'Hallazgos',
    'Activos',
    'Instalaciones',
    'Inventario EPP',
    'Movimientos EPP',
    'Estudios',
    'Documentos',
    'Alertas',
    'Historial',
  ]);
  const sheet = book.getWorksheet('Hallazgos')!;
  expect(sheet.rowCount - 1).toBe(analyze(db, filters).db.findings.length);
  expect(sheet.getCell('D2').value).toBe('Título cambiado durante la sesión');
  expect(sheet.getCell('H2').value).toBeInstanceOf(Date);
  expect(sheet.autoFilter).toBeTruthy();
  expect(sheet.views[0]?.state).toBe('frozen');
});
