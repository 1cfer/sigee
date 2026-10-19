import type { DatabaseV2 } from '../domain/v2';
import type { AnalysisFilters } from '../domain/analysis';
import { analyze } from '../domain/analysis';
import { displayDate, today } from '../domain/dates';
export const REPORT_SECTIONS = [
  'Resumen',
  'Hallazgos',
  'Activos e instalaciones',
  'Inventario EPP',
  'Estudios y documentos',
  'Alertas',
  'Historial',
] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];
async function writer(title: string, subtitle: string) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();
  let y = 32;
  const heading = (text: string) => {
    if (y > 245) {
      doc.addPage();
      y = 30;
    }
    doc.setTextColor('#102c46');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(text, 18, y);
    y += 9;
  };
  const paragraph = (text: string) => {
    doc.setTextColor('#425e6d');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(text, 174) as string[];
    for (const line of lines) {
      if (y > 270) {
        doc.addPage();
        y = 30;
      }
      doc.text(line, 18, y);
      y += 5.5;
    }
    y += 5;
  };
  const table = (headers: string[], rows: (string | number)[][]) => {
    autoTable(doc, {
      startY: y,
      head: [headers],
      body: rows.length
        ? rows
        : [['Sin registros para esta selección.', ...headers.slice(1).map(() => '')]],
      margin: { left: 18, right: 18, top: 25, bottom: 23 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: '#102c46' },
      alternateRowStyles: { fillColor: '#f4f7f8' },
    });
    y = (doc as typeof doc & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  };
  const page = () => {
    doc.addPage();
    y = 32;
  };
  doc.setFillColor('#102c46');
  doc.rect(0, 0, 210, 8, 'F');
  doc.setTextColor('#087f8c');
  doc.setFontSize(12);
  doc.text('SIGEE / DEMOSTRACIÓN', 18, 40);
  doc.setTextColor('#102c46');
  doc.setFontSize(25);
  doc.setFont('helvetica', 'bold');
  doc.text(doc.splitTextToSize(title, 170), 18, 65);
  y = 100;
  paragraph(subtitle);
  heading('Alcance y responsabilidad');
  paragraph(
    'Prototipo independiente con datos simulados. No apto para decisiones operativas de seguridad eléctrica. No es una aplicación oficial ni validada por ISA o Intercolombia.',
  );
  paragraph(
    'Este documento organiza información registrada en el prototipo. No certifica instalaciones, no selecciona EPP y no autoriza trabajos eléctricos. Los estados documentales son administrativos.',
  );
  paragraph(
    `Generado: ${displayDate(today())}. Autoría pública del proyecto: 1cfer. Usuario de demostración sin autenticación.`,
  );
  const finish = () => {
    const count = doc.getNumberOfPages();
    for (let i = 1; i <= count; i++) {
      doc.setPage(i);
      doc.setDrawColor('#dce5e9');
      doc.line(18, 280, 192, 280);
      doc.setFontSize(7);
      doc.setTextColor('#617480');
      doc.setFont('helvetica', 'normal');
      doc.text('SIGEE · Datos simulados · Sin validez para decisiones operativas', 18, 286);
      doc.text(`${i} / ${count}`, 184, 286);
    }
    return doc.output('blob');
  };
  return {
    doc,
    heading,
    paragraph,
    table,
    page,
    finish,
    getY: () => y,
    setY: (value: number) => {
      y = value;
    },
  };
}
export async function createStudyPDF(db: DatabaseV2, id: string): Promise<Blob> {
  const s = db.studies.find((s) => s.id === id);
  if (!s) throw new Error('Estudio inexistente.');
  const asset = db.assets.find((a) => a.id === s.assetId);
  const inst = db.installations.find((i) => i.id === asset?.installationId);
  const w = await writer(
    `${s.reference} · ${s.title}`,
    `Informe ilustrativo de consulta documental. Versión ${s.version}.`,
  );
  w.page();
  w.heading('1. Identificación y alcance');
  w.table(
    ['Campo', 'Registro'],
    [
      ['Activo', `${asset?.code} · ${asset?.name}`],
      ['Instalación', inst?.name ?? ''],
      ['Responsable declarado', s.responsible],
      ['Fecha original', s.studyDate],
      ['Próxima revisión', s.nextReview || 'Sin programación'],
      ['Estado documental', s.documentState],
    ],
  );
  w.heading('Objetivo');
  w.paragraph(s.objective);
  w.heading('Alcance');
  w.paragraph(s.scope);
  w.heading('Descripción del activo');
  w.paragraph(
    `${asset?.description ?? ''} Tensión nominal declarada: ${asset?.nominalVoltage ?? 'Sin registro'}. Esta identificación es ficticia.`,
  );
  w.page();
  w.heading('2. Información técnica ilustrativa');
  w.paragraph(
    'Todos los valores de esta sección son declarados o ficticios. SIGEE no ha ejecutado cálculos ni verificado un método de ingeniería. No deben usarse para dimensionar protección o planificar una intervención.',
  );
  w.table(
    ['Variable', 'Valor declarado / ilustrativo'],
    [
      ['Tensión nominal', s.technical.nominalVoltage || 'No registrada'],
      ['Corriente de cortocircuito', s.technical.shortCircuitCurrent || 'No registrada'],
      ['Distancia de trabajo', s.technical.workingDistance || 'No registrada'],
      ['Energía incidente', s.technical.incidentEnergy || 'No registrada'],
      ['Límite de arco', s.technical.arcBoundary || 'No registrado'],
    ],
  );
  w.heading('Referencia metodológica');
  w.paragraph(s.technical.methodology || 'No registrada.');
  w.heading('Condiciones y supuestos');
  w.paragraph(s.technical.assumptions || 'No registrados.');
  w.heading('Conclusiones documentadas');
  w.paragraph(s.technical.conclusions || 'Sin conclusiones registradas.');
  w.page();
  w.heading('3. Observaciones y trazabilidad');
  w.paragraph(s.observations || 'Sin observaciones.');
  w.heading('Historial de versiones');
  w.table(
    ['Versión', 'Fecha', 'Descripción'],
    [
      [s.version, s.studyDate, 'Versión declarada en la ficha.'],
      ...db.versions
        .filter((v) => v.entityId === id)
        .map((v) => [v.version, v.at.slice(0, 10), v.notes]),
    ],
  );
  w.heading('Revisiones realizadas');
  w.table(
    ['Fecha', 'Responsable', 'Alcance'],
    db.reviews
      .filter((r) => r.entityId === id)
      .map((r) => [r.at.slice(0, 10), r.responsible, r.notes]),
  );
  w.paragraph(
    'La aprobación administrativa o la revisión de este registro no equivale a una certificación de seguridad.',
  );
  return w.finish();
}
export async function createReferencePDF(db: DatabaseV2, id: string) {
  const d = db.documents.find((d) => d.id === id);
  if (!d) throw new Error('Documento inexistente.');
  const w = await writer(
    `${d.code} · ${d.title}`,
    `Documento ficticio de referencia. Versión ${d.version}.`,
  );
  w.page();
  w.heading('Identificación');
  w.table(
    ['Campo', 'Valor'],
    [
      ['Tipo', d.type],
      ['Fecha original', d.originalDate],
      ['Responsable', d.responsible],
      ['Versión', d.version],
      ['Estado', d.documentState],
      ['Activo', d.assetId ?? 'General'],
    ],
  );
  w.heading('Propósito del registro');
  w.paragraph(d.description);
  w.heading('Uso en la demostración');
  w.paragraph(
    'Este archivo permite consultar un PDF, descargarlo, cargar versiones posteriores y registrar revisiones independientes de la edición de metadatos. Su contenido no constituye documentación de una instalación real.',
  );
  w.heading('Control de cambios');
  w.table(
    ['Versión', 'Descripción'],
    [[d.version, 'Documento de ejemplo del conjunto inicial de SIGEE.']],
  );
  return w.finish();
}
export async function createReportPDF(
  db: DatabaseV2,
  filters: AnalysisFilters,
  sections: ReportSection[] = [...REPORT_SECTIONS],
) {
  const a = analyze(db, filters),
    data = a.db;
  const w = await writer(
    'Informe de seguimiento',
    `Período: ${filters.period === 'all' ? 'Todo el historial' : `${filters.start} a ${filters.end}`}. Instalación: ${db.installations.find((i) => i.id === filters.installationId)?.name ?? 'Todas'}. Estado y prioridad: ${filters.status || 'todos'} / ${filters.priority || 'todas'}.`,
  );
  if (sections.includes('Resumen')) {
    w.page();
    w.heading('Resumen ejecutivo');
    w.paragraph(
      `En la selección hay ${a.open.length} hallazgos pendientes, ${a.high.length} de prioridad alta y ${a.overdue.length} con fecha objetivo vencida. Son registros administrativos; una variación de su cantidad no demuestra una mejora o deterioro de la seguridad.`,
    );
    w.table(
      ['Indicador', 'Cantidad'],
      [
        ['Activos', a.metrics.assets],
        ['Hallazgos abiertos', a.metrics.open],
        ['Prioridad alta', a.metrics.high],
        ['Vencidos', a.metrics.overdue],
        ['Inspecciones por revisar', a.metrics.inspections],
        ['Revisiones pendientes / sin fecha', a.metrics.reviews],
      ],
    );
    w.heading('Evolución mensual de registros');
    const chart = a.trend.slice(-12);
    const max = Math.max(1, ...chart.flatMap((t) => [t.creados, t.cerrados]));
    const y = w.getY();
    chart.forEach((t, i) => {
      const x = 20 + i * (170 / chart.length);
      w.doc.setFillColor('#087f8c');
      w.doc.rect(x, y + 38 - (t.creados / max) * 35, 4, (t.creados / max) * 35, 'F');
      w.doc.setFillColor('#8194a3');
      w.doc.rect(x + 5, y + 38 - (t.cerrados / max) * 35, 4, (t.cerrados / max) * 35, 'F');
      w.doc.setFontSize(6);
      w.doc.text(t.name, x, y + 44);
    });
    w.setY(y + 55);
    w.paragraph(
      'Barras: creados (turquesa) y cerrados (gris). Cantidades discretas de registros, sin interpolación.',
    );
    w.table(
      ['Mes', 'Creados', 'Cerrados', 'Pendientes al cierre'],
      a.trend.map((t) => [t.name, t.creados, t.cerrados, t.pendientes]),
    );
  }
  if (sections.includes('Hallazgos')) {
    w.page();
    w.heading('Hallazgos y seguimiento');
    w.table(
      ['Código / activo', 'Título', 'Prioridad / estado', 'Responsable', 'Objetivo'],
      data.findings.map((f) => [
        `${f.code} / ${db.assets.find((a) => a.id === f.assetId)?.code}`,
        f.title,
        `${f.priority} / ${f.status}`,
        f.responsible,
        f.dueDate,
      ]),
    );
    w.heading('Prioritarios y vencidos');
    w.table(
      ['Código', 'Condición'],
      data.findings
        .filter((f) => a.high.includes(f) || a.overdue.includes(f))
        .map((f) => [
          f.code,
          [a.high.includes(f) ? 'Prioridad alta' : '', a.overdue.includes(f) ? 'Vencido' : '']
            .filter(Boolean)
            .join(' · '),
        ]),
    );
  }
  if (sections.includes('Activos e instalaciones')) {
    w.page();
    w.heading('Activos e instalaciones');
    w.table(
      ['Código', 'Nombre', 'Instalación', 'Estado declarado'],
      data.assets.map((r) => [
        r.code,
        r.name,
        db.installations.find((i) => i.id === r.installationId)?.name ?? '',
        r.operationalStatus,
      ]),
    );
    w.table(
      ['Instalación', 'Ubicación', 'Responsable'],
      data.installations.map((i) => [i.name, i.location, i.responsible]),
    );
  }
  if (sections.includes('Inventario EPP')) {
    w.page();
    w.heading('Inventario EPP · Saldo actual');
    w.paragraph(
      'Los saldos representan el estado actual del inventario en la selección. Los movimientos siguientes corresponden al período del informe. No se reconstruyen saldos históricos sin datos.',
    );
    w.table(
      ['Código / referencia', 'Total', 'Disponibles', 'Asignadas', 'No disponibles', 'Inspección'],
      data.ppe.map((p) => [
        `${p.code} / ${p.reference}`,
        p.total,
        p.available,
        p.total - p.available - p.unavailable,
        p.unavailable,
        p.nextInspection || 'Sin fecha',
      ]),
    );
    w.table(
      ['Fecha', 'EPP', 'Movimiento', 'Cantidad', 'Responsable'],
      data.movements.map((m) => [
        calendarDate(m.at),
        db.ppe.find((p) => p.id === m.ppeId)?.code ?? '',
        m.type,
        m.quantity,
        m.responsible,
      ]),
    );
  }
  if (sections.includes('Estudios y documentos')) {
    w.page();
    w.heading('Estudios y documentos');
    w.table(
      ['Referencia', 'Responsable', 'Versión', 'Próxima revisión'],
      [
        ...data.studies.map((s) => [
          s.reference,
          s.responsible,
          s.version,
          s.nextReview || 'Sin fecha',
        ]),
        ...data.documents.map((d) => [
          d.code,
          d.responsible,
          d.version,
          d.reviewDate || 'Sin fecha',
        ]),
      ],
    );
    w.heading('Revisiones realizadas');
    w.table(
      ['Fecha', 'Registro', 'Responsable', 'Observación'],
      db.reviews
        .filter((r) => [...data.studies, ...data.documents].some((s) => s.id === r.entityId))
        .map((r) => [calendarDate(r.at), r.entityId, r.responsible, r.notes]),
    );
  }
  if (sections.includes('Alertas')) {
    w.page();
    w.heading('Avisos de seguimiento');
    w.table(
      ['Origen', 'Título', 'Estado', 'Fecha relevante'],
      data.alertHistory.map((a) => [a.sourceType, a.title, a.status, a.relevantDate]),
    );
  }
  if (sections.includes('Historial')) {
    w.page();
    w.heading('Anexo de trazabilidad');
    w.paragraph(
      'Historial local, editable por el propietario del navegador. No constituye una auditoría inviolable ni certificada.',
    );
    w.table(
      ['Fecha', 'Entidad', 'Acción', 'Responsable', 'Descripción'],
      data.events.map((e) => [
        calendarDate(e.at),
        `${e.entityType} / ${e.entityId}`,
        e.action,
        e.actor,
        e.description,
      ]),
    );
  }
  return w.finish();
}
import { calendarDate } from '../domain/dates';
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
