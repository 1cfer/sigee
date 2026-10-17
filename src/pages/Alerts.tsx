import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CircleAlert, Info } from 'lucide-react';
import { deriveAlerts } from '../domain/selectors';
import { displayDate } from '../domain/dates';
import { useDatabase } from '../store/useDatabase';
import { Badge, EmptyState, FilterSelect, PageHeading, SearchInput } from '../components/ui';

export function Alerts() {
  const db = useDatabase((s) => s.db);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('');
  const [severity, setSeverity] = useState('');
  const all = deriveAlerts(db);
  const alerts = all.filter(
    (a) =>
      `${a.title} ${a.description}`
        .toLocaleLowerCase('es')
        .includes(search.toLocaleLowerCase('es')) &&
      (!source || a.sourceType === source) &&
      (!severity || a.severity === severity),
  );
  return (
    <>
      <PageHeading
        eyebrow="06 / REGLAS DE SEGUIMIENTO"
        title="Alertas"
        description="Cada aviso tiene un origen. Resuelve su causa y se actualizará automáticamente."
      />
      <div className="alert-summary">
        <strong>{all.length}</strong>
        <span>avisos activos</span>
        <span className="summary-divider" />
        <Badge tone="red">
          {all.filter((a) => a.severity === 'prioritaria').length} prioritarios
        </Badge>
        <span className="alert-summary-note">
          <Info size={15} />
          No constituyen una autorización de trabajo.
        </span>
      </div>
      <section className="panel table-panel">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar alerta…" />
          <div className="toolbar-filters">
            <FilterSelect
              label="Todos los orígenes"
              value={source}
              onChange={setSource}
              options={['hallazgo', 'epp', 'estudio', 'documento'].map((v) => ({
                value: v,
                label: v === 'epp' ? 'EPP' : v,
              }))}
            />
            <FilterSelect
              label="Toda severidad"
              value={severity}
              onChange={setSeverity}
              options={['prioritaria', 'atención'].map((v) => ({ value: v, label: v }))}
            />
          </div>
        </div>
        <div className="full-alert-list">
          {alerts.map((a) => (
            <Link to={a.path} className="full-alert" key={a.id}>
              <span className={`alert-symbol ${a.severity === 'prioritaria' ? 'red' : 'amber'}`}>
                <CircleAlert size={19} />
              </span>
              <div>
                <div className="alert-meta">
                  <span>{a.sourceType === 'epp' ? 'EPP' : a.sourceType}</span>
                  <span>·</span>
                  <span>{displayDate(a.relevantDate)}</span>
                </div>
                <h3>{a.title}</h3>
                <p>{a.description}</p>
              </div>
              <Badge tone={a.severity === 'prioritaria' ? 'red' : 'amber'}>{a.severity}</Badge>
              <ArrowUpRight size={17} />
            </Link>
          ))}
        </div>
        {!alerts.length && (
          <EmptyState
            title="Sin avisos para esta vista"
            description="Ajusta los filtros o revisa los registros asociados."
          />
        )}
        <div className="table-footer">
          {alerts.length} avisos · Calculados desde el estado actual, sin duplicados por regla y
          origen.
        </div>
      </section>
      <div className="context-note">
        <Info size={17} />
        <p>
          Los avisos reflejan prioridad o fechas de seguimiento. No determinan si un activo es
          seguro o inseguro para operar.
        </p>
      </div>
    </>
  );
}
