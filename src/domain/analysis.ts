import { endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { calendarDate, today, isPast } from './dates';
import type { DatabaseV2 } from './v2';
export interface AnalysisFilters {
  period: string;
  start: string;
  end: string;
  installationId: string;
  status: string;
  priority: string;
  anchor: string;
}
export const defaultFilters = (): AnalysisFilters => ({
  period: '12',
  start: format(startOfMonth(subMonths(parseISO(today()), 11)), 'yyyy-MM-dd'),
  end: today(),
  installationId: '',
  status: '',
  priority: '',
  anchor: today().slice(0, 7),
});
export function periodRange(period: string, anchor: string, start: string, end: string) {
  const date = parseISO((anchor.length === 4 ? anchor + '-01' : anchor) + '-01');
  const year = Number(anchor.slice(0, 4));
  if (['3', '6', '12'].includes(period))
    return {
      start: format(startOfMonth(subMonths(parseISO(today()), Number(period) - 1)), 'yyyy-MM-dd'),
      end: today(),
    };
  if (period === 'month')
    return {
      start: format(startOfMonth(date), 'yyyy-MM-dd'),
      end: format(endOfMonth(date), 'yyyy-MM-dd'),
    };
  if (period === 'year') return { start: `${year}-01-01`, end: `${year}-12-31` };
  if (period.startsWith('quarter')) {
    const month = (Number(period.slice(-1)) - 1) * 3;
    return {
      start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      end: format(endOfMonth(new Date(year, month + 2, 1)), 'yyyy-MM-dd'),
    };
  }
  if (period.startsWith('semester')) {
    const month = period.endsWith('1') ? 0 : 6;
    return {
      start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      end: format(endOfMonth(new Date(year, month + 5, 1)), 'yyyy-MM-dd'),
    };
  }
  return period === 'all' ? { start: '1900-01-01', end: '2999-12-31' } : { start, end };
}
export function analyze(db: DatabaseV2, filters: AnalysisFilters) {
  const within = (date: string) => Boolean(date) && date >= filters.start && date <= filters.end;
  const installations = db.installations.filter(
    (i) => !filters.installationId || i.id === filters.installationId,
  );
  const installationIds = new Set(installations.map((i) => i.id));
  const assets = db.assets.filter((a) => installationIds.has(a.installationId));
  const assetIds = new Set(assets.map((a) => a.id));
  const cohort = db.findings.filter(
    (f) =>
      !f.archived &&
      assetIds.has(f.assetId) &&
      (!filters.status || f.status === filters.status) &&
      (!filters.priority || f.priority === filters.priority),
  );
  const findings = cohort.filter((f) => within(calendarDate(f.createdAt)));
  const studies = db.studies.filter(
    (s) => !s.archived && assetIds.has(s.assetId) && within(s.studyDate),
  );
  const documents = db.documents.filter(
    (d) =>
      !d.archived &&
      (!filters.installationId ||
        d.installationId === filters.installationId ||
        (d.assetId && assetIds.has(d.assetId))) &&
      within(d.originalDate),
  );
  const ppe = db.ppe.filter(
    (p) => !p.archived && (!filters.installationId || p.installationId === filters.installationId),
  );
  const ids = new Set([...findings, ...studies, ...documents, ...ppe].map((r) => r.id));
  const snapshot: DatabaseV2 = {
    ...db,
    installations,
    assets,
    findings,
    studies,
    documents,
    ppe,
    assignments: db.assignments.filter((a) => ppe.some((p) => p.id === a.ppeId)),
    movements: db.movements.filter(
      (m) => ppe.some((p) => p.id === m.ppeId) && within(calendarDate(m.at)),
    ),
    events: db.events.filter(
      (e) =>
        within(calendarDate(e.at)) &&
        (ids.has(e.entityId) || assetIds.has(e.entityId) || installationIds.has(e.entityId)),
    ),
    alertHistory: db.alertHistory.filter((a) => ids.has(a.sourceId)),
  };
  const overdue = findings.filter((f) => f.status !== 'cerrado' && isPast(f.dueDate));
  const high = findings.filter((f) => f.status !== 'cerrado' && f.priority === 'alta');
  const open = findings.filter((f) => f.status !== 'cerrado');
  const inspections = ppe.filter(
    (p) => !p.nextInspection || isPast(p.nextInspection) || p.inspectionStatus === 'pendiente',
  );
  const reviews = [
    ...studies.filter((s) => reviewState(s.nextReview) !== 'Al día'),
    ...documents.filter((d) => reviewState(d.reviewDate) !== 'Al día'),
  ];
  const months =
    filters.period === 'all'
      ? 6
      : Math.min(
          24,
          Math.max(
            1,
            (Number(filters.end.slice(0, 4)) - Number(filters.start.slice(0, 4))) * 12 +
              Number(filters.end.slice(5, 7)) -
              Number(filters.start.slice(5, 7)) +
              1,
          ),
        );
  const endMonth = parseISO(filters.period === 'all' ? today() : filters.end);
  const trend = Array.from({ length: months }, (_, i) => {
    const date = subMonths(startOfMonth(endMonth), months - 1 - i);
    const prefix = format(date, 'yyyy-MM');
    const cutoff = format(endOfMonth(date), 'yyyy-MM-dd');
    const pendingRecords = cohort.filter((f) => {
      if (calendarDate(f.createdAt) > cutoff) return false;
      const transitions = db.findingEvents
        .filter((e) => e.findingId === f.id)
        .flatMap((e) =>
          (e.changes ?? [])
            .filter((c) => c.field === 'status')
            .map((c) => ({ at: calendarDate(e.at), ...c })),
        )
        .sort((a, b) => a.at.localeCompare(b.at));
      const previous = transitions.filter((t) => t.at <= cutoff).at(-1);
      const state =
        previous?.after ??
        transitions[0]?.before ??
        (f.closedAt && calendarDate(f.closedAt) <= cutoff ? 'cerrado' : 'abierto');
      return state !== 'cerrado';
    });
    const createdRecords = cohort.filter(
      (f) => within(calendarDate(f.createdAt)) && calendarDate(f.createdAt).startsWith(prefix),
    );
    const closedRecords = cohort.filter((f) => {
      const transitions = db.findingEvents.filter(
        (e) =>
          e.findingId === f.id &&
          (e.changes ?? []).some((c) => c.field === 'status' && c.after === 'cerrado'),
      );
      return transitions.length
        ? transitions.some(
            (e) => within(calendarDate(e.at)) && calendarDate(e.at).startsWith(prefix),
          )
        : Boolean(
            f.closedAt &&
            within(calendarDate(f.closedAt)) &&
            calendarDate(f.closedAt).startsWith(prefix),
          );
    });
    return {
      month: prefix,
      createdRecords,
      closedRecords,
      pendingRecords,
      name: format(date, 'MMM yy', { locale: es }),
      creados: createdRecords.length,
      cerrados: closedRecords.length,
      pendientes: pendingRecords.length,
    };
  });
  const closed = findings.filter((f) => f.closedAt);
  const averageClosure = closed.length
    ? closed.reduce(
        (sum, f) => sum + (Date.parse(f.closedAt!) - Date.parse(f.createdAt)) / 86400000,
        0,
      ) / closed.length
    : null;
  return {
    db: snapshot,
    cohort,
    open,
    high,
    overdue,
    inspections,
    reviews,
    trend,
    averageClosure,
    metrics: {
      assets: assets.length,
      open: open.length,
      high: high.length,
      overdue: overdue.length,
      inspections: inspections.length,
      reviews: reviews.length,
    },
  };
}
export function inventoryReasons(db: DatabaseV2, id: string) {
  const reasons: Record<string, number> = {};
  for (const m of db.movements.filter((m) => m.ppeId === id))
    for (const [reason, value] of Object.entries(m.unavailableDelta))
      reasons[reason] = (reasons[reason] ?? 0) + (value ?? 0);
  return reasons;
}
export const reviewState = (date: string) =>
  !date
    ? 'Sin fecha programada'
    : isPast(date)
      ? 'Vencido'
      : date <= format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd')
        ? 'Próximo a revisión'
        : 'Al día';
