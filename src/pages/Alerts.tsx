import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert } from 'lucide-react';
import { useDatabase } from '../store/useDatabase';
import { displayDate } from '../domain/dates';
import { Badge, EmptyState, FilterSelect, Modal, PageHeading, SearchInput } from '../components/ui';
import { History } from '../components/RecordTools';
import { useToast } from '../components/toast-context';
export function Alerts() {
  const db = useDatabase((s) => s.db);
  const [search, setSearch] = useState(''),
    [state, setState] = useState('vigentes'),
    [source, setSource] = useState(''),
    [history, setHistory] = useState<string>();
  const toast = useToast();
  const alerts = db.alertHistory
    .filter(
      (a) =>
        (state === 'vigentes'
          ? a.status !== 'resuelta'
          : state === 'todas' || a.status === state) &&
        (!source || a.sourceType === source) &&
        `${a.title} ${a.description}`
          .toLocaleLowerCase('es')
          .includes(search.toLocaleLowerCase('es')),
    )
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  return (
    <>
      <PageHeading
        eyebrow="06 / CONDICIONES Y SEGUIMIENTO"
        title="Alertas"
        description="Reconocer un aviso registra el seguimiento. Resolver su causa actualiza el estado y conserva el historial."
      />
      <div className="alert-summary">
        <strong>{db.alertHistory.filter((a) => a.status !== 'resuelta').length}</strong>
        <span>avisos vigentes</span>
        <span className="summary-divider" />
        <Badge tone="red">
          {
            db.alertHistory.filter((a) => a.status !== 'resuelta' && a.severity === 'prioritaria')
              .length
          }{' '}
          prioritarios
        </Badge>
      </div>
      <section className="panel table-panel">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar alerta…" />
          <div className="toolbar-filters">
            <select
              className="filter-select"
              aria-label="Estado de alerta"
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              {[
                ['vigentes', 'Vigentes'],
                ['activa', 'Activas'],
                ['reconocida', 'Reconocidas'],
                ['resuelta', 'Resueltas'],
                ['todas', 'Todas con historial'],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <FilterSelect
              label="Todos los orígenes"
              value={source}
              onChange={setSource}
              options={['hallazgo', 'epp', 'estudio', 'documento'].map((value) => ({
                value,
                label: value,
              }))}
            />
          </div>
        </div>
        <div className="full-alert-list">
          {alerts.map((a) => (
            <article className="full-alert alert-v2" key={a.id}>
              <span className={`alert-symbol ${a.severity === 'prioritaria' ? 'red' : 'amber'}`}>
                <CircleAlert size={19} />
              </span>
              <div>
                <div className="alert-meta">
                  {a.sourceType} · Generada {displayDate(a.generatedAt)} · {a.severity}
                </div>
                <Link className="table-title" to={a.path}>
                  {a.title}
                </Link>
                <p>{a.description}</p>
                <p className="muted">{a.action}</p>
                <div className="detail-actions">
                  {a.status === 'activa' && (
                    <button
                      className="button secondary"
                      onClick={() =>
                        void useDatabase
                          .getState()
                          .acknowledge(a.id)
                          .then(() => toast('Aviso reconocido; la causa sigue activa.'))
                          .catch((e) => toast(String(e)))
                      }
                    >
                      Reconocer aviso
                    </button>
                  )}
                  <button className="text-link" onClick={() => setHistory(a.id)}>
                    Consultar historial
                  </button>
                </div>
                {a.resolvedAt && (
                  <small>Resuelta automáticamente: {displayDate(a.resolvedAt)}</small>
                )}
              </div>
              <Badge
                tone={
                  a.status === 'resuelta' ? 'teal' : a.status === 'reconocida' ? 'neutral' : 'amber'
                }
              >
                {a.status}
              </Badge>
            </article>
          ))}
        </div>
        {!alerts.length && (
          <EmptyState
            title="Sin avisos en esta vista"
            description="Ajusta los filtros para consultar condiciones activas y su historial."
          />
        )}
        <div className="table-footer">
          {alerts.length} avisos · Una condición por regla y registro, sin duplicados.
        </div>
      </section>
      <div className="context-note">
        Estos avisos requieren seguimiento administrativo. No autorizan trabajos ni determinan
        condiciones seguras de operación.
      </div>
      {history && (
        <Modal
          open
          wide
          onClose={() => setHistory(undefined)}
          title="Historial de alerta"
          description="Generación, reconocimiento y resolución por cambios en la causa."
        >
          <div className="record-body">
            <History kind="alert" id={history} />
          </div>
        </Modal>
      )}
    </>
  );
}
