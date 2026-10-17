import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleAlert,
  FileCheck2,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDatabase } from '../store/useDatabase';
import { deriveAlerts, selectCharts, selectMetrics } from '../domain/selectors';
import { displayDate, today } from '../domain/dates';
import { downloadCSV } from '../domain/export';
import { FindingEditor } from '../components/FindingEditor';
import { Badge, EmptyState, InlineLink, PageHeading } from '../components/ui';

export function Dashboard() {
  const db = useDatabase((s) => s.db);
  const [create, setCreate] = useState(false);
  const metrics = useMemo(() => selectMetrics(db), [db]);
  const charts = useMemo(() => selectCharts(db), [db]);
  const alerts = useMemo(() => deriveAlerts(db), [db]);
  const activity = [...db.findingEvents].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
  const total = db.findings.length;
  return (
    <>
      <PageHeading
        eyebrow="01 / VISIÓN GENERAL"
        title="Centro de control"
        description="Una visión conectada de tus registros y acciones de seguimiento."
        actions={
          <>
            <button
              className="button secondary"
              onClick={() =>
                downloadCSV(
                  'sigee-indicadores.csv',
                  ['Indicador', 'Cantidad', 'Datos'],
                  [
                    ['Activos registrados', metrics.assets, 'Simulados'],
                    ['Hallazgos abiertos', metrics.open, 'Simulados'],
                    ['Prioridad alta', metrics.high, 'Simulados'],
                    ['Hallazgos vencidos', metrics.overdue, 'Simulados'],
                    ['Inspecciones pendientes', metrics.inspections, 'Simulados'],
                    ['Revisiones pendientes', metrics.reviews, 'Simulados'],
                  ],
                )
              }
            >
              <ArrowDownToLine size={16} />
              Exportar resumen
            </button>
            <button className="button primary" onClick={() => setCreate(true)}>
              <Plus size={17} />
              Crear hallazgo
            </button>
          </>
        }
      />
      <div className="section-caption">
        <span>
          <span className="online-dot" />
          Resumen del seguimiento
        </span>
        <span>
          <CalendarDays size={14} />
          {displayDate(today())}
        </span>
      </div>
      <section className="metrics-strip" aria-label="Indicadores calculados">
        {[
          {
            key: 'open',
            label: 'Hallazgos abiertos',
            value: metrics.open,
            sub: 'Incluye registros en progreso',
            to: '/hallazgos?estado=pendientes',
          },
          {
            key: 'high',
            label: 'Prioridad alta',
            value: metrics.high,
            sub: 'Pendientes de cierre',
            to: '/hallazgos?prioridad=alta&estado=pendientes',
          },
          {
            key: 'overdue',
            label: 'Hallazgos vencidos',
            value: metrics.overdue,
            sub: 'Fecha objetivo superada',
            to: '/hallazgos?estado=vencidos',
          },
          {
            key: 'assets',
            label: 'Activos registrados',
            value: metrics.assets,
            sub: `${db.installations.length} instalaciones ficticias`,
            to: '/activos',
          },
        ].map((m, i) => (
          <Link to={m.to} className={`metric metric-${m.key}`} key={m.key}>
            <div className="metric-label">
              {m.label}
              <ArrowUpRight size={15} />
            </div>
            <strong data-testid={`metric-${m.key}`}>
              {m.value.toString().padStart(2, '0')}
              {i === 0 && <span className="metric-unit">/ {total}</span>}
            </strong>
            <span className="metric-sub">
              <span className={`metric-dot dot-${i}`} />
              {m.sub}
            </span>
          </Link>
        ))}
      </section>
      <div className="review-strip">
        <span className="tiny-label">TAMBIÉN REQUIEREN SEGUIMIENTO</span>
        <Link to="/epp?pendientes=1">
          <ShieldCheck size={17} />
          <strong>{metrics.inspections}</strong> inspecciones EPP pendientes
          <ChevronRight size={15} />
        </Link>
        <Link to="/estudios-documentos?pendientes=1">
          <FileCheck2 size={17} />
          <strong>{metrics.reviews}</strong> documentos y estudios por revisar
          <ChevronRight size={15} />
        </Link>
      </div>
      <div className="dashboard-main-grid">
        <section className="panel trend-panel">
          <div className="panel-header">
            <div>
              <p className="tiny-label">EVOLUCIÓN DE REGISTROS</p>
              <h2>El seguimiento en el tiempo</h2>
            </div>
            <Badge>Últimos 6 meses</Badge>
          </div>
          <div className="chart-legend">
            <span>
              <i style={{ background: 'var(--teal)' }} />
              Creados
            </span>
            <span>
              <i style={{ background: '#8b9cac' }} />
              Cerrados
            </span>
          </div>
          <div
            className="trend-chart"
            role="img"
            aria-label={`Tendencia mensual de hallazgos: ${charts.trend.map((t) => `${t.name}: ${t.creados} creados, ${t.cerrados} cerrados`).join('; ')}`}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.trend} margin={{ top: 10, right: 12, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#087f8c" stopOpacity={0.13} />
                    <stop offset="100%" stopColor="#087f8c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e9edf0" strokeDasharray="3 5" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: '#617480' }}
                  dy={8}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#617480' }}
                />
                <Tooltip
                  labelFormatter={(label) => `Mes: ${label}`}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5ebf0', fontSize: 12 }}
                />
                <Area
                  name="Creados"
                  type="monotone"
                  dataKey="creados"
                  stroke="#087f8c"
                  fill="url(#trendFill)"
                  strokeWidth={2.5}
                  isAnimationActive={false}
                />
                <Area
                  name="Cerrados"
                  type="monotone"
                  dataKey="cerrados"
                  stroke="#8b9cac"
                  fill="transparent"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="panel-footnote">Fechas de creación y cierre de los registros simulados.</p>
        </section>
        <section className="panel attention-panel">
          <div className="panel-header">
            <div>
              <p className="tiny-label">PARA TU REVISIÓN</p>
              <h2>Alertas de seguimiento</h2>
            </div>
            <span className="count-circle">{alerts.length}</span>
          </div>
          <div className="alert-preview-list">
            {alerts.slice(0, 3).map((a) => (
              <Link to={a.path} key={a.id} className="alert-preview">
                <span className={`alert-symbol ${a.severity === 'prioritaria' ? 'red' : 'amber'}`}>
                  <CircleAlert size={17} />
                </span>
                <div>
                  <span className="tiny-label">
                    {a.severity === 'prioritaria' ? 'PRIORIDAD ALTA' : 'FECHA SUPERADA'}
                  </span>
                  <h3>{a.title}</h3>
                  <p>{a.description}</p>
                </div>
                <ArrowUpRight size={15} />
              </Link>
            ))}
            {!alerts.length && (
              <EmptyState
                title="Sin alertas pendientes"
                description="Las reglas no detectan seguimientos por fecha o prioridad."
              />
            )}
          </div>
          <Link className="panel-bottom-link" to="/alertas">
            Ver todas las alertas
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="dashboard-bottom-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="tiny-label">DISTRIBUCIÓN</p>
              <h2>Estado de los hallazgos</h2>
            </div>
          </div>
          <div className="segmented-bar" aria-hidden="true">
            {charts.statuses.map((s, i) => (
              <span key={s.name} className={`segment-${i}`} style={{ flex: s.value }} />
            ))}
          </div>
          <div className="status-breakdown">
            {charts.statuses.map((s, i) => (
              <div key={s.name}>
                <span>
                  <i className={`segment-${i}`} />
                  {s.name}
                </span>
                <strong>
                  {s.value}
                  <small>{total ? Math.round((s.value / total) * 100) : 0}%</small>
                </strong>
              </div>
            ))}
          </div>
          <div className="priority-summary">
            <span className="tiny-label">ABIERTOS POR PRIORIDAD</span>
            {charts.priorities.map((p) => (
              <span key={p.name}>
                {p.name} <strong>{p.value}</strong>
              </span>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="tiny-label">INSTALACIONES FICTICIAS</p>
              <h2>Hallazgos pendientes</h2>
            </div>
          </div>
          <div className="installation-bars">
            {charts.installations.map((i, index) => (
              <Link to={`/activos?instalacion=${db.installations[index]?.id}`} key={i.name}>
                <div>
                  <span>{i.name}</span>
                  <strong>{i.value}</strong>
                </div>
                <div className="bar-track">
                  <span
                    style={{
                      width: `${(i.value / Math.max(1, ...charts.installations.map((v) => v.value))) * 100}%`,
                    }}
                  />
                </div>
              </Link>
            ))}
          </div>
          <div className="panel-inline-link">
            <InlineLink to="/activos">Explorar activos</InlineLink>
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="tiny-label">TRAZABILIDAD</p>
              <h2>Actividad reciente</h2>
            </div>
          </div>
          <div className="activity-list">
            {activity.map((e) => {
              const f = db.findings.find((f) => f.id === e.findingId);
              return (
                <Link to={`/hallazgos?registro=${e.findingId}`} key={e.id}>
                  <span className="activity-dot" />
                  <div>
                    <p>{e.kind === 'comentario' ? 'Nuevo comentario' : e.text}</p>
                    <span>
                      {f?.code} · {displayDate(e.at)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
      <div className="context-note">
        <span className="context-note-mark">i</span>
        <p>
          Los indicadores reflejan registros administrativos simulados. Las alertas orientan el
          seguimiento y no autorizan trabajos.
        </p>
      </div>
      {create && <FindingEditor onClose={() => setCreate(false)} />}
    </>
  );
}
