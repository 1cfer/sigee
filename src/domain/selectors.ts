import { format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { calendarDate, isPast, today } from './dates';
import type { DemoDatabase, DerivedAlert } from './types';

export function deriveAlerts(db: DemoDatabase, now = today()): DerivedAlert[] {
  const alerts: DerivedAlert[] = [];
  for (const f of db.findings) {
    if (f.status === 'cerrado' || ('archived' in f && f.archived)) continue;
    const base = {
      sourceType: 'hallazgo' as const,
      sourceId: f.id,
      relevantDate: f.dueDate,
      path: `/hallazgos?registro=${f.id}`,
      assetId: f.assetId,
    };
    if (f.priority === 'alta')
      alerts.push({
        ...base,
        id: `R1:${f.id}`,
        severity: 'prioritaria',
        title: f.title,
        description: `${f.code} · Prioridad alta pendiente de cierre.`,
      });
    if (isPast(f.dueDate, now))
      alerts.push({
        ...base,
        id: `R2:${f.id}`,
        severity: 'atención',
        title: `Fecha objetivo vencida · ${f.code}`,
        description: f.title,
      });
  }
  for (const p of db.ppe)
    if (
      !('archived' in p && p.archived) &&
      (isPast(p.nextInspection, now) || p.inspectionStatus === 'pendiente')
    )
      alerts.push({
        id: `R3:${p.id}`,
        sourceType: 'epp',
        sourceId: p.id,
        severity: 'atención',
        title: `Inspección pendiente · ${p.type}`,
        description: `${p.code} · Revisar el registro de inspección.`,
        relevantDate: p.nextInspection,
        path: `/epp?registro=${p.id}`,
      });
  for (const s of db.studies)
    if (
      !('archived' in s && s.archived) &&
      s.nextReview &&
      (isPast(s.nextReview, now) ||
        (s.nextReview >= now &&
          s.nextReview <=
            format(new Date(new Date(now + 'T12:00:00Z').getTime() + 30 * 86400000), 'yyyy-MM-dd')))
    )
      alerts.push({
        id: `R4:estudio:${s.id}`,
        sourceType: 'estudio',
        sourceId: s.id,
        severity: 'atención',
        title: `${isPast(s.nextReview, now) ? 'Revisión pendiente' : 'Próxima revisión'} · ${s.reference}`,
        description: 'Registro documental de estudio pendiente de revisión.',
        relevantDate: s.nextReview,
        path: `/estudios-documentos?tipo=estudios&registro=${s.id}`,
        assetId: s.assetId,
      });
  for (const d of db.documents)
    if (!('archived' in d && d.archived) && isPast(d.reviewDate, now))
      alerts.push({
        id: `R4:documento:${d.id}`,
        sourceType: 'documento',
        sourceId: d.id,
        severity: 'atención',
        title: `Revisión pendiente · ${d.code}`,
        description: d.title,
        relevantDate: d.reviewDate,
        path: `/estudios-documentos?tipo=documentos&registro=${d.id}`,
        assetId: d.assetId,
      });
  return alerts.sort(
    (a, b) =>
      Number(b.severity === 'prioritaria') - Number(a.severity === 'prioritaria') ||
      a.relevantDate.localeCompare(b.relevantDate) ||
      a.id.localeCompare(b.id),
  );
}

export function selectMetrics(db: DemoDatabase, now = today()) {
  const open = db.findings.filter(
    (f) => f.status !== 'cerrado' && !('archived' in f && f.archived),
  );
  return {
    assets: db.assets.length,
    open: open.length,
    high: open.filter((f) => f.priority === 'alta').length,
    overdue: open.filter((f) => isPast(f.dueDate, now)).length,
    inspections: db.ppe.filter(
      (p) => isPast(p.nextInspection, now) || p.inspectionStatus === 'pendiente',
    ).length,
    reviews:
      db.studies.filter((s) => isPast(s.nextReview, now) || s.status === 'pendiente de revisión')
        .length +
      db.documents.filter((d) => isPast(d.reviewDate, now) || d.status === 'pendiente de revisión')
        .length,
  };
}
export function selectCharts(db: DemoDatabase, now = today()) {
  return {
    statuses: ['abierto', 'en progreso', 'pendiente de verificación', 'cerrado'].map((name) => ({
      name,
      value: db.findings.filter((f) => f.status === name).length,
    })),
    priorities: ['alta', 'media', 'baja'].map((name) => ({
      name,
      value: db.findings.filter((f) => f.priority === name && f.status !== 'cerrado').length,
    })),
    installations: db.installations.map((i) => ({
      name: i.name.replace('Estación ', ''),
      value: db.findings.filter(
        (f) =>
          f.status !== 'cerrado' &&
          db.assets.find((a) => a.id === f.assetId)?.installationId === i.id,
      ).length,
    })),
    trend: Array.from({ length: 6 }, (_, i) => {
      const month = startOfMonth(subMonths(parseISO(now), 5 - i));
      const prefix = format(month, 'yyyy-MM');
      return {
        name: format(month, 'MMM', { locale: es }),
        creados: db.findings.filter((f) => calendarDate(f.createdAt).startsWith(prefix)).length,
        cerrados: db.findings.filter(
          (f) => f.closedAt && calendarDate(f.closedAt).startsWith(prefix),
        ).length,
      };
    }),
  };
}

export function assetReviewPending(db: DemoDatabase, id: string, now = today()) {
  return (
    db.studies.some(
      (s) =>
        s.assetId === id &&
        !('archived' in s && s.archived) &&
        (!s.nextReview || isPast(s.nextReview, now)),
    ) ||
    db.documents.some(
      (d) =>
        d.assetId === id &&
        !('archived' in d && d.archived) &&
        (!d.reviewDate || isPast(d.reviewDate, now)),
    )
  );
}
