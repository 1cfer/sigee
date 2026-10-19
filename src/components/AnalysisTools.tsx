import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDatabase } from '../store/useDatabase';
import { periodRange, type AnalysisFilters } from '../domain/analysis';
import { entityPath, type EntityKind } from '../domain/v2';
import { displayDate } from '../domain/dates';
import { REPORT_SECTIONS, type ReportSection, createReportPDF, downloadBlob } from '../reports/pdf';
import { createExcel } from '../reports/excel';
import { useToast } from './toast-context';
import { EmptyState, Field, Modal } from './ui';
import { errorMessage } from '../domain/errors';

export function AnalysisFilterBar({
  value,
  onChange,
}: {
  value: AnalysisFilters;
  onChange: (next: AnalysisFilters) => void;
}) {
  const installations = useDatabase((s) => s.db.installations);
  const change = (key: keyof AnalysisFilters, v: string) => {
    const next = { ...value, [key]: v };
    if (['period', 'anchor'].includes(key))
      Object.assign(next, periodRange(next.period, next.anchor, next.start, next.end));
    onChange(next);
  };
  return (
    <section className="analysis-filters" aria-label="Filtros del análisis">
      <div className="filter-grid">
        <Field label="Período">
          <select value={value.period} onChange={(e) => change('period', e.target.value)}>
            {[
              ['3', 'Últimos 3 meses'],
              ['6', 'Últimos 6 meses'],
              ['12', 'Últimos 12 meses'],
              ['month', 'Mes específico'],
              ['quarter1', 'Primer trimestre'],
              ['quarter2', 'Segundo trimestre'],
              ['quarter3', 'Tercer trimestre'],
              ['quarter4', 'Cuarto trimestre'],
              ['semester1', 'Primer semestre'],
              ['semester2', 'Segundo semestre'],
              ['year', 'Año'],
              ['custom', 'Rango personalizado'],
              ['all', 'Todo el historial'],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {!['3', '6', '12', 'all', 'custom'].includes(value.period) && (
          <Field label="Mes / año de referencia">
            <input
              type="month"
              value={value.anchor}
              onChange={(e) => {
                if (e.target.value) change('anchor', e.target.value);
              }}
            />
          </Field>
        )}
        {value.period === 'custom' && (
          <>
            <Field label="Desde">
              <input
                type="date"
                value={value.start}
                max={value.end}
                onChange={(e) => {
                  if (e.target.value) change('start', e.target.value);
                }}
              />
            </Field>
            <Field label="Hasta">
              <input
                type="date"
                value={value.end}
                min={value.start}
                onChange={(e) => {
                  if (e.target.value) change('end', e.target.value);
                }}
              />
            </Field>
          </>
        )}
        <Field label="Instalación">
          <select
            value={value.installationId}
            onChange={(e) => change('installationId', e.target.value)}
          >
            <option value="">Todas las instalaciones</option>
            {installations.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado de hallazgo">
          <select value={value.status} onChange={(e) => change('status', e.target.value)}>
            <option value="">Todos los estados</option>
            {['abierto', 'en progreso', 'pendiente de verificación', 'cerrado'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Prioridad de hallazgo">
          <select value={value.priority} onChange={(e) => change('priority', e.target.value)}>
            <option value="">Todas las prioridades</option>
            {['alta', 'media', 'baja'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <details className="filter-explanation">
        <summary>Cómo se aplican estos filtros</summary>
        <p>
          El período filtra la creación de hallazgos, la fecha original de estudios y documentos y
          las fechas de movimientos y actividad. Los activos y saldos EPP muestran el estado actual
          de la instalación. Estado y prioridad afectan a hallazgos. La serie histórica incluye
          pendientes creados antes del período; sus registros se pueden consultar desde la gráfica.
        </p>
      </details>
    </section>
  );
}
export type TraceRow = {
  id: string;
  kind: EntityKind;
  code: string;
  title: string;
  status?: string;
  responsible?: string;
  date?: string;
  asset?: string;
};
export function TraceDialog({
  title,
  rows,
  onClose,
}: {
  title: string;
  rows: TraceRow[];
  onClose: () => void;
}) {
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={title}
      description={`${rows.length} registros exactos que componen esta selección.`}
    >
      <div className="record-body">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Registro</th>
                <th>Activo</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th>Fecha de referencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`}>
                  <td>
                    <Link className="table-title" to={entityPath(r.kind, r.id)}>
                      {r.code} · {r.title}
                    </Link>
                  </td>
                  <td>{r.asset || '—'}</td>
                  <td>{r.status || '—'}</td>
                  <td>{r.responsible || '—'}</td>
                  <td>{r.date ? displayDate(r.date) : 'Sin programación'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <EmptyState
            title="Sin registros en la selección"
            description="Ajusta el período o la instalación para consultar otros registros."
          />
        )}
      </div>
    </Modal>
  );
}
export function ReportDialog({
  filters,
  onClose,
}: {
  filters: AnalysisFilters;
  onClose: () => void;
}) {
  const db = useDatabase((s) => s.db);
  const [value, setValue] = useState(filters),
    [sections, setSections] = useState<ReportSection[]>([...REPORT_SECTIONS]),
    [format, setFormat] = useState('pdf'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const toast = useToast();
  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      if (!sections.length) throw new Error('Selecciona al menos una sección.');
      if (value.start > value.end) throw new Error('Revisa el rango de fechas.');
      const blob = await (format === 'pdf'
        ? createReportPDF(db, value, sections)
        : createExcel(db, value, sections));
      downloadBlob(
        blob,
        `SIGEE-informe-${value.period === 'all' ? 'historial' : value.start}.${format}`,
      );
      toast('Informe generado con los registros de la selección.');
    } catch (e) {
      setError(errorMessage(e, 'No se pudo generar el informe.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Generar informe"
      description="Exportación de los datos guardados, incluidos los cambios de esta sesión."
    >
      <div className="record-body">
        <AnalysisFilterBar value={value} onChange={setValue} />
        <h3>Secciones incluidas</h3>
        <div className="report-sections">
          {REPORT_SECTIONS.map((section) => (
            <label key={section} className="check-label">
              <input
                type="checkbox"
                checked={sections.includes(section)}
                onChange={(e) =>
                  setSections(
                    e.target.checked
                      ? [...sections, section]
                      : sections.filter((s) => s !== section),
                  )
                }
              />
              {section}
            </label>
          ))}
        </div>
        <Field label="Formato de informe">
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="pdf">PDF · Informe para presentación</option>
            <option value="xlsx">Excel · Libro de análisis con 10 hojas</option>
          </select>
        </Field>
        <p className="muted">
          Los gráficos del PDF son vectoriales. Los archivos Excel conservan identificadores y
          fechas. Los saldos EPP corresponden al estado actual.
        </p>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button className="button primary" disabled={busy} onClick={() => void generate()}>
            {busy ? 'Generando informe…' : 'Descargar informe'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
