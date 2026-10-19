import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import { useDatabase } from '../store/useDatabase';
import { displayDate } from '../domain/dates';
import { reviewState } from '../domain/analysis';
import {
  ArchiveButton,
  Attachments,
  EntityEditor,
  History,
  RecordState,
  RecordTabs,
  Reviews,
} from '../components/RecordTools';
import {
  Badge,
  EmptyState,
  FilterSelect,
  Modal,
  PageHeading,
  SearchInput,
  StatusBadge,
} from '../components/ui';

export function Documents() {
  const db = useDatabase((s) => s.db);
  const [params, setParams] = useSearchParams();
  const [detailTab, setDetailTab] = useState('consulta');
  const [search, setSearch] = useState(''),
    [state, setState] = useState(''),
    [showArchived, setShowArchived] = useState(false),
    [edit, setEdit] = useState<{ kind: 'study' | 'document'; id?: string }>();
  const tab = params.get('tipo') === 'documentos' ? 'documentos' : 'estudios';
  const kind = tab === 'estudios' ? 'study' : 'document';
  const set = (key: string, value: string) => {
    if (key === 'registro') setDetailTab('consulta');
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'tipo') next.delete('registro');
    setParams(next);
  };
  const rows = (tab === 'estudios' ? db.studies : db.documents).filter(
    (r) =>
      (showArchived || !r.archived) &&
      `${'reference' in r ? r.reference : r.code} ${r.title} ${r.responsible} ${db.assets.find((a) => a.id === r.assetId)?.code ?? ''}`
        .toLocaleLowerCase('es')
        .includes(search.toLocaleLowerCase('es')) &&
      (!state || r.documentState === state),
  );
  const selected = (tab === 'estudios' ? db.studies : db.documents).find(
    (r) => r.id === params.get('registro'),
  );
  return (
    <>
      <PageHeading
        eyebrow="05 / CONOCIMIENTO Y TRAZABILIDAD"
        title="Estudios y documentos"
        description="Consulta el contenido, conserva versiones y registra cada revisión por separado."
        actions={
          <button className="button primary" onClick={() => setEdit({ kind })}>
            <Plus size={16} />
            Crear {tab === 'estudios' ? 'estudio' : 'documento'}
          </button>
        }
      />
      <div className="tabs" role="group" aria-label="Tipo de registro documental">
        {['estudios', 'documentos'].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => set('tipo', t)}>
            {t === 'estudios' ? 'Estudios de referencia' : 'Documentos'}{' '}
            <span>{t === 'estudios' ? db.studies.length : db.documents.length}</span>
          </button>
        ))}
      </div>
      <section className="panel table-panel">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar referencia, título o responsable…"
          />
          <div className="toolbar-filters">
            <FilterSelect
              label="Todos los estados documentales"
              value={state}
              onChange={setState}
              options={['borrador', 'en revisión', 'aprobado administrativamente', 'archivado'].map(
                (value) => ({ value, label: value }),
              )}
            />
            <label className="check-label">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Incluir archivados
            </label>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Registro</th>
                <th>Activo</th>
                <th>Versión</th>
                <th>Estado documental</th>
                <th>Seguimiento</th>
                <th>Archivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const code = 'reference' in r ? r.reference : r.code;
                const next = 'nextReview' in r ? r.nextReview : r.reviewDate;
                const files = db.attachments.filter((a) => a.entityId === r.id);
                return (
                  <tr key={r.id}>
                    <td>
                      <button className="table-title" onClick={() => set('registro', r.id)}>
                        {r.title}
                      </button>
                      <span className="table-sub">
                        {code} · {r.responsible}
                      </span>
                    </td>
                    <td>
                      {r.assetId ? (
                        <Link className="code-link" to={`/activos/${r.assetId}`}>
                          {db.assets.find((a) => a.id === r.assetId)?.code}
                        </Link>
                      ) : (
                        'General'
                      )}
                    </td>
                    <td>{r.version}</td>
                    <td>
                      <StatusBadge status={r.archived ? 'archivado' : r.documentState} />
                    </td>
                    <td>
                      <Badge tone={reviewState(next) === 'Al día' ? 'teal' : 'amber'}>
                        {reviewState(next)}
                      </Badge>
                      <span className="table-sub">
                        {next ? displayDate(next) : 'Sin programación'}
                      </span>
                    </td>
                    <td>
                      {files.length ? (
                        `${files.length} archivo(s)`
                      ) : (
                        <span className="overdue-text">Sin archivo</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <EmptyState
            title="No hay registros en esta vista"
            description="Registra un documento o un estudio para vincular contenido, versiones y revisiones."
            action={
              <button className="button primary" onClick={() => setEdit({ kind })}>
                Crear registro
              </button>
            }
          />
        )}
        <div className="table-footer">
          {rows.length} registros · La aprobación administrativa no certifica seguridad.
        </div>
      </section>
      <div className="context-note">
        <FileText size={17} />
        <p>
          Referencias ficticias para demostrar gestión documental. SIGEE no realiza cálculos de
          ingeniería ni sustituye un estudio profesional.
        </p>
      </div>
      {selected && (
        <Modal
          open
          wide
          title={'reference' in selected ? selected.reference : selected.code}
          description="Ficha de consulta · Contenido demostrativo y seguimiento administrativo."
          onClose={() => set('registro', '')}
        >
          <div className="record-body">
            <RecordState archived={selected.archived} provenance={selected.provenance} />
            <h2>{selected.title}</h2>
            <div className="detail-actions">
              <button
                className="button secondary"
                onClick={() => setEdit({ kind, id: selected.id })}
              >
                Editar metadatos
              </button>
              <ArchiveButton kind={kind} id={selected.id} archived={selected.archived} />
            </div>
            <RecordTabs
              value={detailTab}
              onChange={setDetailTab}
              label="Consulta documental"
              options={[
                ['consulta', 'Identificación'],
                ['contenido', 'Contenido'],
                ['archivos', 'Archivos y PDF'],
                ['revisiones', 'Revisiones'],
                ['historial', 'Historial'],
              ].map(([value, label]) => ({ value: value!, label: label! }))}
            />
            {detailTab === 'consulta' && (
              <dl className="detail-grid">
                <div>
                  <dt>Activo asociado</dt>
                  <dd>
                    {selected.assetId ? (
                      <Link className="text-link" to={`/activos/${selected.assetId}`}>
                        {db.assets.find((a) => a.id === selected.assetId)?.code}
                      </Link>
                    ) : (
                      'General'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Responsable</dt>
                  <dd>{selected.responsible}</dd>
                </div>
                <div>
                  <dt>Estado documental</dt>
                  <dd>{selected.documentState}</dd>
                </div>
                <div>
                  <dt>Seguimiento</dt>
                  <dd>
                    {reviewState(
                      'nextReview' in selected ? selected.nextReview : selected.reviewDate,
                    )}
                  </dd>
                </div>
                {[
                  ['Fecha original', selected.originalDate],
                  ['Creación del registro', selected.createdAt],
                  ['Carga del archivo', selected.uploadedAt],
                  ['Última modificación', selected.updatedAt],
                  ['Última revisión formal', selected.lastReviewedAt],
                  [
                    'Próxima revisión',
                    'nextReview' in selected ? selected.nextReview : selected.reviewDate,
                  ],
                ].map(([label, date]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{date ? displayDate(date) : 'Sin registrar'}</dd>
                  </div>
                ))}
              </dl>
            )}
            {detailTab === 'contenido' &&
              ('technical' in selected ? (
                <>
                  <section className="record-section">
                    <h3>Objetivo y alcance</h3>
                    <p>{selected.objective || 'Sin objetivo registrado.'}</p>
                    <p>{selected.scope || 'Sin alcance registrado.'}</p>
                    <p>{selected.observations}</p>
                  </section>
                  <section className="record-section">
                    <h3>Referencia técnica ilustrativa</h3>
                    <p className="context-note">
                      Valores declarados y simulados. No son resultados calculados, recomendaciones
                      de EPP ni autorización de trabajo.
                    </p>
                    <dl className="detail-grid">
                      {Object.entries(selected.technical).map(([key, value]) => (
                        <div key={key}>
                          <dt>
                            {
                              {
                                nominalVoltage: 'Tensión nominal',
                                shortCircuitCurrent: 'Corriente de cortocircuito',
                                workingDistance: 'Distancia de trabajo',
                                incidentEnergy: 'Energía incidente',
                                arcBoundary: 'Frontera de arco',
                                methodology: 'Metodología',
                                assumptions: 'Supuestos',
                                conclusions: 'Conclusiones',
                              }[key]
                            }
                          </dt>
                          <dd>{value || 'Sin información'}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </>
              ) : (
                <>
                  <p className="detail-description">
                    {selected.description || 'Sin descripción adicional.'}
                  </p>
                  {selected.installationId && (
                    <Link
                      className="text-link"
                      to={`/activos?vista=instalaciones&instalacionDetalle=${selected.installationId}`}
                    >
                      Consultar instalación relacionada
                    </Link>
                  )}
                  {selected.findingId && (
                    <Link className="text-link" to={`/hallazgos?registro=${selected.findingId}`}>
                      Consultar hallazgo relacionado
                    </Link>
                  )}
                </>
              ))}
            {detailTab === 'archivos' && <Attachments kind={kind} id={selected.id} />}
            {detailTab === 'revisiones' && <Reviews kind={kind} id={selected.id} />}
            {detailTab === 'historial' && <History kind={kind} id={selected.id} />}
          </div>
        </Modal>
      )}
      {edit && (
        <EntityEditor
          key={`${edit.kind}-${edit.id}`}
          {...edit}
          onClose={() => setEdit(undefined)}
          onSaved={(id) => set('registro', id)}
        />
      )}
    </>
  );
}
