import type { DatabaseV2 } from '../domain/v2';
import { analyze, type AnalysisFilters } from '../domain/analysis';
import type { ReportSection } from './pdf';
export async function createExcel(
  db: DatabaseV2,
  filters: AnalysisFilters,
  sections: ReportSection[],
): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '1cfer';
  workbook.subject = 'SIGEE · Datos simulados';
  const a = analyze(db, filters),
    data = a.db;
  const sheet = (
    name: string,
    headers: string[],
    rows: (string | number | Date | undefined)[][],
  ) => {
    const page = workbook.addWorksheet(name);
    page.addRow(headers);
    rows.forEach((r) => page.addRow(r.map((v) => v ?? '')));
    page.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    page.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF102C46' } };
    page.views = [{ state: 'frozen', ySplit: 1 }];
    page.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, page.rowCount), column: headers.length },
    };
    page.columns.forEach((c, i) => {
      c.width = Math.min(50, Math.max(16, headers[i]!.length + 4));
    });
    page.eachRow((row, n) => {
      if (n > 1)
        row.eachCell((cell) => {
          if (cell.value instanceof Date) cell.numFmt = 'yyyy-mm-dd';
        });
    });
  };
  const date = (value: string | undefined) =>
    value ? new Date(value.length === 10 ? value + 'T12:00:00Z' : value) : undefined;
  sheet(
    'Resumen',
    ['Indicador', 'Valor'],
    [
      ['Datos', 'Simulados. Sin validez operativa.'],
      ['Inicio', date(filters.start)],
      ['Fin', date(filters.end)],
      [
        'Instalación',
        db.installations.find((i) => i.id === filters.installationId)?.name || 'Todas',
      ],
      ['Estado de hallazgo', filters.status || 'Todos'],
      ['Prioridad de hallazgo', filters.priority || 'Todas'],
      ...Object.entries(a.metrics).map(([key, value]): [string, number] => [
        (
          {
            assets: 'Activos registrados',
            open: 'Hallazgos abiertos',
            high: 'Prioridad alta pendiente',
            overdue: 'Hallazgos vencidos',
            inspections: 'Inspecciones pendientes',
            reviews: 'Revisiones pendientes',
          } as Record<string, string>
        )[key] ?? key,
        value,
      ]),
      ['Tiempo promedio de cierre (días)', a.averageClosure ?? 'Sin datos'],
    ],
  );
  if (sections.includes('Hallazgos'))
    sheet(
      'Hallazgos',
      [
        'ID',
        'Código',
        'Activo ID',
        'Título',
        'Prioridad',
        'Estado',
        'Responsable',
        'Creación',
        'Objetivo',
        'Cierre',
        'Acción',
        'Justificación',
      ],
      data.findings.map((f) => [
        f.id,
        f.code,
        f.assetId,
        f.title,
        f.priority,
        f.status,
        f.responsible,
        date(f.createdAt),
        date(f.dueDate),
        date(f.closedAt),
        f.correctiveAction,
        f.closureJustification,
      ]),
    );
  if (sections.includes('Activos e instalaciones')) {
    sheet(
      'Activos',
      [
        'ID',
        'Código',
        'Nombre',
        'Instalación ID',
        'Tipo',
        'Tensión nominal',
        'Estado administrativo',
        'Estado operativo declarado',
      ],
      data.assets.map((r) => [
        r.id,
        r.code,
        r.name,
        r.installationId,
        r.type,
        r.nominalVoltage,
        r.administrativeStatus,
        r.operationalStatus,
      ]),
    );
    sheet(
      'Instalaciones',
      ['ID', 'Código', 'Nombre', 'Ubicación', 'Responsable', 'Archivada'],
      data.installations.map((i) => [
        i.id,
        i.code,
        i.name,
        i.location,
        i.responsible,
        i.archived ? 'Sí' : 'No',
      ]),
    );
  }
  if (sections.includes('Inventario EPP')) {
    sheet(
      'Inventario EPP',
      [
        'ID',
        'Código',
        'Nombre',
        'Referencia',
        'Total',
        'Disponibles',
        'Asignadas',
        'No disponibles',
        'Próxima inspección',
        'Ubicación',
      ],
      data.ppe.map((p) => [
        p.id,
        p.code,
        p.type,
        p.reference,
        p.total,
        p.available,
        p.total - p.available - p.unavailable,
        p.unavailable,
        date(p.nextInspection),
        p.location,
      ]),
    );
    sheet(
      'Movimientos EPP',
      [
        'ID',
        'EPP ID',
        'Tipo',
        'Fecha',
        'Cantidad',
        'Delta disponibles',
        'Delta asignadas',
        'Motivos / deltas',
        'Responsable',
        'Origen',
        'Observaciones',
      ],
      data.movements.map((m) => [
        m.id,
        m.ppeId,
        m.type,
        date(m.at),
        m.quantity,
        m.availableDelta,
        m.assignedDelta,
        JSON.stringify(m.unavailableDelta),
        m.responsible,
        m.source,
        m.notes,
      ]),
    );
  }
  if (sections.includes('Estudios y documentos')) {
    sheet(
      'Estudios',
      [
        'ID',
        'Referencia',
        'Título',
        'Activo ID',
        'Fecha estudio',
        'Versión',
        'Responsable',
        'Última revisión',
        'Próxima revisión',
        'Estado documental',
      ],
      data.studies.map((s) => [
        s.id,
        s.reference,
        s.title,
        s.assetId,
        date(s.studyDate),
        s.version,
        s.responsible,
        date(s.lastReviewedAt),
        date(s.nextReview),
        s.documentState,
      ]),
    );
    sheet(
      'Documentos',
      [
        'ID',
        'Código',
        'Título',
        'Tipo',
        'Activo ID',
        'Instalación ID',
        'Hallazgo ID',
        'Versión',
        'Responsable',
        'Fecha original',
        'Fecha carga',
        'Última revisión',
        'Próxima revisión',
        'Estado',
      ],
      data.documents.map((d) => [
        d.id,
        d.code,
        d.title,
        d.type,
        d.assetId,
        d.installationId,
        d.findingId,
        d.version,
        d.responsible,
        date(d.originalDate),
        date(d.uploadedAt),
        date(d.lastReviewedAt),
        date(d.reviewDate),
        d.documentState,
      ]),
    );
  }
  if (sections.includes('Alertas'))
    sheet(
      'Alertas',
      [
        'ID',
        'Origen',
        'Registro ID',
        'Título',
        'Prioridad',
        'Estado',
        'Generación',
        'Fecha relevante',
      ],
      data.alertHistory.map((a) => [
        a.id,
        a.sourceType,
        a.sourceId,
        a.title,
        a.severity,
        a.status,
        date(a.generatedAt),
        date(a.relevantDate),
      ]),
    );
  if (sections.includes('Historial'))
    sheet(
      'Historial',
      [
        'ID',
        'Entidad',
        'Registro ID',
        'Acción',
        'Fecha',
        'Responsable',
        'Descripción',
        'Antes',
        'Después',
      ],
      data.events.map((e) => [
        e.id,
        e.entityType,
        e.entityId,
        e.action,
        date(e.at),
        e.actor,
        e.description,
        JSON.stringify(e.before ?? {}),
        JSON.stringify(e.after ?? {}),
      ]),
    );
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
