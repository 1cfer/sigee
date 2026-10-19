import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpRight, Plus } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDatabase } from '../store/useDatabase';
import { analyze, defaultFilters, inventoryReasons } from '../domain/analysis';
import { displayDate, isPast } from '../domain/dates';
import { entityPath } from '../domain/v2';
import { FindingEditor } from '../components/FindingEditor';
import {
  AnalysisFilterBar,
  ReportDialog,
  TraceDialog,
  type TraceRow,
} from '../components/AnalysisTools';
import { Badge, EmptyState, PageHeading } from '../components/ui';

export function Dashboard() {
  const db = useDatabase((s) => s.db);
  const [filters, setFilters] = useState(defaultFilters),
    [tab, setTab] = useState('general'),
    [create, setCreate] = useState(false),
    [report, setReport] = useState(false),
    [trace, setTrace] = useState<{ title: string; rows: TraceRow[] }>();
  const a = useMemo(() => analyze(db, filters), [db, filters]);
  const findingRows = (items: typeof db.findings): TraceRow[] =>
    items.map((f) => ({
      id: f.id,
      kind: 'finding',
      code: f.code,
      title: f.title,
      status: f.status,
      responsible: f.responsible,
      date: f.dueDate,
      asset: db.assets.find((r) => r.id === f.assetId)?.code,
    }));
  const assetRows = (items: typeof db.assets): TraceRow[] =>
    items.map((r) => ({
      id: r.id,
      kind: 'asset',
      code: r.code,
      title: r.name,
      status: r.operationalStatus,
      responsible: r.responsible,
    }));
  const ppeRows = (items: typeof db.ppe): TraceRow[] =>
    items.map((r) => ({
      id: r.id,
      kind: 'ppe',
      code: r.code,
      title: `${r.type} · ${r.available} disponibles / ${r.unavailable} no disponibles`,
      status: r.inspectionStatus,
      date: r.nextInspection,
    }));
  const documentRows = (
    items: ((typeof db.studies)[number] | (typeof db.documents)[number])[],
  ): TraceRow[] =>
    items.map((r) => ({
      id: r.id,
      kind: 'reference' in r ? 'study' : 'document',
      code: 'reference' in r ? r.reference : r.code,
      title: r.title,
      status: r.documentState,
      responsible: r.responsible,
      date: 'nextReview' in r ? r.nextReview : r.reviewDate,
    }));
  const show = (title: string, rows: TraceRow[]) => setTrace({ title, rows });
  const metric = (key: string, label: string, value: number, rows: TraceRow[], sub: string) => (
    <button className={`metric metric-${key}`} key={key} onClick={() => show(label, rows)}>
      <span className="metric-label">
        {label}
        <ArrowUpRight size={15} />
      </span>
      <strong data-testid={`metric-${key}`}>{String(value).padStart(2, '0')}</strong>
      <span className="metric-sub">{sub}</span>
    </button>
  );
  const distribution = (title: string, items: { label: string; rows: TraceRow[] }[]) => (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
      </div>
      <div className="distribution-list">
        {items.map((item) => (
          <button key={item.label} onClick={() => show(`${title} · ${item.label}`, item.rows)}>
            <span>{item.label}</span>
            <strong>{item.rows.length}</strong>
            <span className="distribution-track">
              <i
                style={{
                  width: `${(item.rows.length / Math.max(1, ...items.map((i) => i.rows.length))) * 100}%`,
                }}
              />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
  const alerts = a.db.alertHistory.filter((r) => r.status !== 'resuelta');
  const activeAssets = a.db.assets.filter((r) => !r.archived);
  const pendingAssets = activeAssets.filter((r) => a.open.some((f) => f.assetId === r.id));
  return (
    <>
      <PageHeading
        eyebrow="01 / INFORMACIÓN PARA EL SEGUIMIENTO"
        title="Centro de control"
        description="Registros conectados, indicadores explicables y decisiones de seguimiento con contexto."
        actions={
          <>
            <button className="button secondary" onClick={() => setReport(true)}>
              <ArrowDownToLine size={16} />
              Generar informe
            </button>
            <button className="button primary" onClick={() => setCreate(true)}>
              <Plus size={16} />
              Crear hallazgo
            </button>
          </>
        }
      />
      <div className="tabs dashboard-tabs" role="group" aria-label="Vistas del centro de control">
        {[
          ['general', 'Visión general'],
          ['hallazgos', 'Hallazgos'],
          ['recursos', 'Activos y EPP'],
          ['documental', 'Estudios y documentos'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? 'active' : ''}
            onClick={() => setTab(value!)}
          >
            {label}
          </button>
        ))}
      </div>
      <AnalysisFilterBar value={filters} onChange={setFilters} />
      <div className="section-caption">
        <span>
          <span className="online-dot" /> Selección actual ·{' '}
          {filters.period === 'all'
            ? 'Todo el historial'
            : `${displayDate(filters.start)} — ${displayDate(filters.end)}`}
        </span>
        <span>Selecciona una cifra para consultar sus registros</span>
      </div>
      <section className="metrics-strip" aria-label="Indicadores calculados">
        {metric(
          'open',
          'Hallazgos abiertos',
          a.open.length,
          findingRows(a.open),
          'Incluye progreso y verificación',
        )}
        {metric(
          'high',
          'Prioridad alta',
          a.high.length,
          findingRows(a.high),
          'Pendientes de cierre',
        )}
        {metric(
          'overdue',
          'Hallazgos vencidos',
          a.overdue.length,
          findingRows(a.overdue),
          'Fecha objetivo superada',
        )}
        {metric(
          'assets',
          'Activos registrados',
          a.db.assets.length,
          assetRows(a.db.assets),
          'Estado actual por instalación',
        )}
      </section>
      <div className="review-strip">
        <span className="tiny-label">TAMBIÉN REQUIEREN SEGUIMIENTO</span>
        <button onClick={() => show('Inspecciones EPP pendientes', ppeRows(a.inspections))}>
          <strong>{a.inspections.length}</strong> inspecciones EPP pendientes{' '}
          <ArrowUpRight size={14} />
        </button>
        <button onClick={() => show('Estudios y documentos por revisar', documentRows(a.reviews))}>
          <strong>{a.reviews.length}</strong> estudios y documentos por revisar{' '}
          <ArrowUpRight size={14} />
        </button>
      </div>
      {(tab === 'general' || tab === 'hallazgos') && (
        <>
          <div className="dashboard-main-grid">
            <section className="panel trend-panel">
              <div className="panel-header">
                <div>
                  <p className="tiny-label">EVOLUCIÓN DE REGISTROS</p>
                  <h2>Hallazgos creados y cerrados por mes</h2>
                </div>
                <Badge>Unidades: registros</Badge>
              </div>
              <div
                className="trend-chart"
                role="img"
                aria-label={a.trend
                  .map((t) => `${t.name}: ${t.creados} creados, ${t.cerrados} cerrados`)
                  .join('; ')}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={a.trend} margin={{ left: -20, right: 16, top: 12, bottom: 0 }}>
                    <CartesianGrid stroke="#e9edf0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="creados"
                      name="Creados"
                      fill="#087f8c"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="cerrados"
                      name="Cerrados"
                      fill="#8194a3"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="panel-footnote">
                Eventos de creación y cierre registrados; cada mes representa una cantidad exacta.
              </p>
            </section>
            {tab === 'general' ? (
              <section className="panel attention-panel">
                <div className="panel-header">
                  <h2>Alertas en la selección</h2>
                  <span className="count-circle">{alerts.length}</span>
                </div>
                <div className="related-list">
                  {alerts.slice(0, 3).map((r) => (
                    <Link key={r.id} to={r.path}>
                      <div>
                        <Badge tone={r.severity === 'prioritaria' ? 'red' : 'amber'}>
                          {r.status}
                        </Badge>
                        <h3>{r.title}</h3>
                        <p>{r.description}</p>
                      </div>
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
                </div>
                {!alerts.length && (
                  <EmptyState
                    title="Sin alertas en la selección"
                    description="Puedes ampliar el período para revisar otros registros."
                  />
                )}
                <Link className="panel-bottom-link" to="/alertas">
                  Abrir centro de alertas <ArrowUpRight size={16} />
                </Link>
              </section>
            ) : (
              <section className="panel">
                <div className="panel-header">
                  <h2>Pendientes al cierre de cada mes</h2>
                </div>
                <div
                  className="trend-chart"
                  role="img"
                  aria-label={a.trend
                    .map((t) => `${t.name}: ${t.pendientes} pendientes`)
                    .join('; ')}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={a.trend} margin={{ left: -20, right: 16, top: 12, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#e9edf0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line
                        name="Pendientes"
                        type="stepAfter"
                        dataKey="pendientes"
                        stroke="#102c46"
                        strokeWidth={2}
                        dot
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="panel-footnote">
                  Incluye el arrastre anterior al período y los estados registrados en el historial.
                </p>
              </section>
            )}
          </div>
          {tab === 'hallazgos' && (
            <>
              <section className="panel table-panel">
                <div className="panel-header">
                  <h2>Detalle mensual · abrir registros</h2>
                  <p className="muted">
                    Promedio de cierre:{' '}
                    {a.averageClosure === null
                      ? 'Sin datos'
                      : `${a.averageClosure.toFixed(1)} días (${a.db.findings.filter((f) => f.closedAt).length} cierres)`}
                  </p>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Mes</th>
                        <th>Creados</th>
                        <th>Cerrados</th>
                        <th>Pendientes al cierre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.trend.map((t) => (
                        <tr key={t.month}>
                          <td>{t.name}</td>
                          <td>
                            <button
                              className="text-link"
                              onClick={() =>
                                show(`Creados · ${t.name}`, findingRows(t.createdRecords))
                              }
                            >
                              {t.creados}
                            </button>
                          </td>
                          <td>
                            <button
                              className="text-link"
                              onClick={() =>
                                show(`Cerrados · ${t.name}`, findingRows(t.closedRecords))
                              }
                            >
                              {t.cerrados}
                            </button>
                          </td>
                          <td>
                            <button
                              className="text-link"
                              onClick={() =>
                                show(
                                  `Pendientes al cierre · ${t.name}`,
                                  findingRows(t.pendingRecords),
                                )
                              }
                            >
                              {t.pendientes}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          <div className="dashboard-bottom-grid">
            {distribution(
              'Por estado',
              ['abierto', 'en progreso', 'pendiente de verificación', 'cerrado'].map((label) => ({
                label,
                rows: findingRows(a.db.findings.filter((r) => r.status === label)),
              })),
            )}
            {distribution(
              'Prioridad de pendientes',
              ['alta', 'media', 'baja'].map((label) => ({
                label,
                rows: findingRows(a.open.filter((r) => r.priority === label)),
              })),
            )}
            {distribution(
              'Pendientes por instalación',
              a.db.installations.map((i) => ({
                label: i.name,
                rows: findingRows(
                  a.open.filter((r) =>
                    db.assets.some(
                      (asset) => asset.id === r.assetId && asset.installationId === i.id,
                    ),
                  ),
                ),
              })),
            )}
          </div>
        </>
      )}
      {tab === 'general' && (
        <div className="dashboard-main-grid">
          <section className="panel">
            <div className="panel-header">
              <h2>Próximos compromisos</h2>
            </div>
            <div className="related-list">
              {a.open
                .slice()
                .sort((x, y) => x.dueDate.localeCompare(y.dueDate))
                .slice(0, 4)
                .map((f) => (
                  <Link key={f.id} to={entityPath('finding', f.id)}>
                    <div>
                      <span className="table-sub">
                        {f.code} · {f.responsible}
                      </span>
                      <h3>{f.title}</h3>
                      <p>{displayDate(f.dueDate)}</p>
                    </div>
                    <Badge tone={isPast(f.dueDate) ? 'amber' : 'neutral'}>
                      {isPast(f.dueDate) ? 'Vencido' : 'Programado'}
                    </Badge>
                  </Link>
                ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>Actividad reciente</h2>
            </div>
            <div className="activity-list">
              {a.db.events
                .slice()
                .sort((x, y) => y.at.localeCompare(x.at))
                .slice(0, 5)
                .map((e) => (
                  <Link key={e.id} to={entityPath(e.entityType, e.entityId)}>
                    <span className="activity-dot" />
                    <div>
                      <p>{e.description}</p>
                      <span>
                        {e.action} · {displayDate(e.at)}
                      </span>
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        </div>
      )}
      {tab === 'recursos' && (
        <>
          <div className="dashboard-bottom-grid">
            {distribution(
              'Activos por instalación',
              a.db.installations.map((i) => ({
                label: i.name,
                rows: assetRows(a.db.assets.filter((r) => r.installationId === i.id)),
              })),
            )}
            {distribution('Seguimiento de activos', [
              { label: 'Con hallazgos pendientes', rows: assetRows(pendingAssets) },
              {
                label: 'Sin hallazgos pendientes',
                rows: assetRows(activeAssets.filter((r) => !pendingAssets.includes(r))),
              },
            ])}
            <section className="panel">
              <div className="panel-header">
                <h2>Estado actual del inventario</h2>
              </div>
              <div className="distribution-list">
                {[
                  [
                    'Disponibles',
                    a.db.ppe.reduce((s, p) => s + p.available, 0),
                    a.db.ppe.filter((p) => p.available > 0),
                  ],
                  [
                    'Asignadas',
                    a.db.assignments
                      .filter((r) => !r.returnedAt)
                      .reduce((s, r) => s + r.quantity, 0),
                    a.db.ppe.filter((p) =>
                      a.db.assignments.some((r) => r.ppeId === p.id && !r.returnedAt),
                    ),
                  ],
                  [
                    'No disponibles',
                    a.db.ppe.reduce((s, p) => s + p.unavailable, 0),
                    a.db.ppe.filter((p) => p.unavailable > 0),
                  ],
                ].map(([label, count, items]) => (
                  <button
                    key={String(label)}
                    onClick={() =>
                      show(
                        `EPP · ${label} (unidades por referencia)`,
                        ppeRows(items as typeof db.ppe),
                      )
                    }
                  >
                    <span>{String(label)}</span>
                    <strong>{String(count)}</strong>
                  </button>
                ))}
              </div>
            </section>
          </div>
          {distribution(
            'No disponibles por motivo',
            Object.entries(
              a.db.ppe.reduce<Record<string, number>>((sum, p) => {
                for (const [r, n] of Object.entries(inventoryReasons(db, p.id)))
                  sum[r] = (sum[r] ?? 0) + n;
                return sum;
              }, {}),
            ).map(([reason, count]) => ({
              label: `${reason} · ${count} unidades`,
              rows: ppeRows(a.db.ppe.filter((p) => (inventoryReasons(db, p.id)[reason] ?? 0) > 0)),
            })),
          )}
        </>
      )}
      {tab === 'documental' && (
        <>
          <div className="dashboard-bottom-grid">
            {distribution('Registros documentales', [
              { label: 'Estudios', rows: documentRows(a.db.studies) },
              { label: 'Documentos', rows: documentRows(a.db.documents) },
            ])}
            {distribution(
              'Documentos por categoría',
              [...new Set(a.db.documents.map((d) => d.type))].map((label) => ({
                label,
                rows: documentRows(a.db.documents.filter((r) => r.type === label)),
              })),
            )}
            {distribution('Programación de revisiones', [
              {
                label: 'Vencidas',
                rows: documentRows([
                  ...a.db.studies.filter((r) => isPast(r.nextReview)),
                  ...a.db.documents.filter((r) => isPast(r.reviewDate)),
                ]),
              },
              {
                label: 'Sin fecha programada',
                rows: documentRows([
                  ...a.db.studies.filter((r) => !r.nextReview),
                  ...a.db.documents.filter((r) => !r.reviewDate),
                ]),
              },
              { label: 'Pendientes de revisión', rows: documentRows(a.reviews) },
            ])}
          </div>
          <section className="panel">
            <div className="panel-header">
              <h2>Actividad documental</h2>
            </div>
            <div className="activity-list">
              {a.db.events
                .filter((e) => e.entityType === 'study' || e.entityType === 'document')
                .sort((x, y) => y.at.localeCompare(x.at))
                .slice(0, 8)
                .map((e) => (
                  <Link key={e.id} to={entityPath(e.entityType, e.entityId)}>
                    <div>
                      <p>
                        {e.action} · {e.description}
                      </p>
                      <span>
                        {displayDate(e.at)} · {e.actor}
                      </span>
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        </>
      )}
      <div className="context-note">
        Los indicadores representan registros administrativos simulados.{' '}
        {a.db.studies.length + a.db.documents.length === 0
          ? 'El período seleccionado no contiene fechas originales de estudios o documentos. Amplía el período para incluirlos.'
          : 'Las revisiones y el inventario requieren validación profesional fuera de este prototipo.'}
      </div>
      <section className="quality-note">
        <h3>Calidad de datos</h3>
        <p>
          {
            [...a.db.studies, ...a.db.documents].filter(
              (r) => !db.attachments.some((file) => file.entityId === r.id),
            ).length
          }{' '}
          registros documentales sin archivo. {a.db.studies.filter((r) => !r.nextReview).length}{' '}
          estudios sin próxima revisión. {a.db.ppe.filter((r) => !r.lastInspection).length}{' '}
          referencias EPP sin inspección formal registrada.
        </p>
        <button
          className="text-link"
          onClick={() =>
            show(
              'Registros documentales sin archivo',
              documentRows(
                [...a.db.studies, ...a.db.documents].filter(
                  (r) => !db.attachments.some((file) => file.entityId === r.id),
                ),
              ),
            )
          }
        >
          Revisar registros
        </button>
      </section>
      {create && <FindingEditor onClose={() => setCreate(false)} />}{' '}
      {report && <ReportDialog filters={filters} onClose={() => setReport(false)} />}{' '}
      {trace && <TraceDialog {...trace} onClose={() => setTrace(undefined)} />}
    </>
  );
}
