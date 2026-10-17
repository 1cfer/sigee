import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Boxes, Plus } from 'lucide-react';
import { useDatabase } from '../store/useDatabase';
import { assetReviewPending, deriveAlerts } from '../domain/selectors';
import { displayDate } from '../domain/dates';
import { FindingEditor } from '../components/FindingEditor';
import {
  Badge,
  EmptyState,
  FilterSelect,
  InlineLink,
  PageHeading,
  PriorityBadge,
  SearchInput,
  StatusBadge,
} from '../components/ui';

export function Assets() {
  const db = useDatabase((s) => s.db);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState('code');
  const [review, setReview] = useState('');
  const installation = params.get('instalacion') ?? '';
  const filtered = db.assets
    .filter(
      (a) =>
        `${a.code} ${a.name} ${a.nominalVoltage}`
          .toLocaleLowerCase('es')
          .includes(search.toLocaleLowerCase('es')) &&
        (!installation || a.installationId === installation) &&
        (!type || a.type === type) &&
        (!review || assetReviewPending(db, a.id) === (review === 'pendiente')),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, 'es')
        : sort === 'findings'
          ? db.findings.filter((f) => f.assetId === b.id && f.status !== 'cerrado').length -
            db.findings.filter((f) => f.assetId === a.id && f.status !== 'cerrado').length
          : a.code.localeCompare(b.code),
    );
  return (
    <>
      <PageHeading
        eyebrow="02 / REGISTROS CONECTADOS"
        title="Activos eléctricos"
        description="Un punto de encuentro para los hallazgos, documentos y recursos de cada activo."
      />
      <div className="small-summary">
        <Boxes size={18} />
        <strong>{db.assets.length} activos</strong>
        <span>en {db.installations.length} instalaciones ficticias</span>
      </div>
      <section className="panel table-panel">
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar activo o código…" />
          <div className="toolbar-filters">
            <FilterSelect
              label="Todas las instalaciones"
              value={installation}
              onChange={(v) => {
                const next = new URLSearchParams(params);
                if (v) next.set('instalacion', v);
                else next.delete('instalacion');
                setParams(next);
              }}
              options={db.installations.map((i) => ({ value: i.id, label: i.name }))}
            />
            <FilterSelect
              label="Todos los tipos"
              value={type}
              onChange={setType}
              options={[...new Set(db.assets.map((a) => a.type))].map((v) => ({
                value: v,
                label: v,
              }))}
            />
            <FilterSelect
              label="Revisión documental"
              value={review}
              onChange={setReview}
              options={[
                { value: 'pendiente', label: 'Pendiente de revisión' },
                { value: 'registrado', label: 'Sin pendientes' },
              ]}
            />
            <select
              className="filter-select"
              aria-label="Ordenar activos"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="code">Ordenar: código</option>
              <option value="name">Ordenar: nombre</option>
              <option value="findings">Ordenar: hallazgos</option>
            </select>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Activo</th>
                <th>Instalación</th>
                <th>Tipo / tensión nominal</th>
                <th>Estado administrativo</th>
                <th>Hallazgos abiertos</th>
                <th>Revisión documental</th>
                <th>
                  <span className="sr-only">Ficha</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link className="table-title" to={`/activos/${a.id}`}>
                      {a.name}
                    </Link>
                    <span className="table-sub">{a.code}</span>
                  </td>
                  <td>{db.installations.find((i) => i.id === a.installationId)?.name}</td>
                  <td>
                    {a.type}
                    <span className="table-sub">{a.nominalVoltage} · Referencia ficticia</span>
                  </td>
                  <td>
                    <StatusBadge status={a.administrativeStatus} />
                  </td>
                  <td>
                    <span className="number-pill">
                      {
                        db.findings.filter((f) => f.assetId === a.id && f.status !== 'cerrado')
                          .length
                      }
                    </span>
                  </td>
                  <td>
                    <Badge tone={assetReviewPending(db, a.id) ? 'amber' : 'teal'}>
                      {assetReviewPending(db, a.id) ? 'Pendiente' : 'Sin pendientes'}
                    </Badge>
                  </td>
                  <td>
                    <Link
                      className="icon-button"
                      aria-label={`Abrir ${a.code}`}
                      to={`/activos/${a.id}`}
                    >
                      <ArrowUpRight size={17} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <EmptyState />}
        <div className="table-footer">
          {filtered.length} de {db.assets.length} activos · Información ficticia de referencia
        </div>
      </section>
    </>
  );
}

export function AssetDetail() {
  const { id } = useParams();
  const db = useDatabase((s) => s.db);
  const [create, setCreate] = useState(false);
  const asset = db.assets.find((a) => a.id === id);
  if (!asset)
    return (
      <EmptyState
        title="Activo no encontrado"
        description="El identificador no corresponde a un activo del conjunto de demostración."
        action={<InlineLink to="/activos">Volver a activos</InlineLink>}
      />
    );
  const findings = db.findings.filter((f) => f.assetId === id);
  const studies = db.studies.filter((s) => s.assetId === id);
  const documents = db.documents.filter((d) => d.assetId === id);
  const assignments = db.assignments.filter((a) => a.assetId === id);
  const alerts = deriveAlerts(db).filter(
    (a) =>
      a.assetId === id ||
      (a.sourceType === 'epp' && assignments.some((p) => p.ppeId === a.sourceId)),
  );
  const events = db.findingEvents
    .filter((e) => findings.some((f) => f.id === e.findingId))
    .sort((a, b) => b.at.localeCompare(a.at));
  return (
    <>
      <Link className="back-link" to="/activos">
        <ArrowLeft size={15} />
        Todos los activos
      </Link>
      <PageHeading
        eyebrow={`02 / FICHA DEL ACTIVO · ${asset.code}`}
        title={asset.name}
        description={`${db.installations.find((i) => i.id === asset.installationId)?.name} · Instalación ficticia`}
        actions={
          <button className="button primary" onClick={() => setCreate(true)}>
            <Plus size={17} />
            Crear hallazgo
          </button>
        }
      />
      <section className="asset-facts panel">
        <div>
          <span>Código</span>
          <strong>{asset.code}</strong>
        </div>
        <div>
          <span>Tipo</span>
          <strong>{asset.type}</strong>
        </div>
        <div>
          <span>Tensión nominal ficticia</span>
          <strong>{asset.nominalVoltage}</strong>
        </div>
        <div>
          <span>Estado administrativo</span>
          <StatusBadge status={asset.administrativeStatus} />
        </div>
      </section>
      <div className="detail-columns">
        <div className="stack">
          <section className="panel">
            <div className="panel-header">
              <h2>Hallazgos asociados</h2>
              <span className="count-circle">{findings.length}</span>
            </div>
            {findings.length ? (
              <div className="related-list">
                {findings.map((f) => (
                  <Link to={`/hallazgos?registro=${f.id}`} key={f.id}>
                    <div>
                      <span className="table-sub">{f.code}</span>
                      <h3>{f.title}</h3>
                      <p>
                        {f.responsible} · {displayDate(f.dueDate)}
                      </p>
                    </div>
                    <div className="related-badges">
                      <PriorityBadge priority={f.priority} />
                      <StatusBadge status={f.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Sin hallazgos registrados"
                description="Puedes crear una observación ficticia para este activo."
              />
            )}
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>Estudios y documentos</h2>
              <span className="count-circle">{studies.length + documents.length}</span>
            </div>
            <div className="related-list">
              {studies.map((s) => (
                <Link key={s.id} to={`/estudios-documentos?tipo=estudios&registro=${s.id}`}>
                  <div>
                    <span className="table-sub">Estudio documental · {s.reference}</span>
                    <h3>Registro de estudio de arco eléctrico</h3>
                    <p>
                      Versión {s.version} · Revisión {displayDate(s.nextReview)}
                    </p>
                  </div>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
              {documents.map((d) => (
                <Link key={d.id} to={`/estudios-documentos?tipo=documentos&registro=${d.id}`}>
                  <div>
                    <span className="table-sub">{d.code}</span>
                    <h3>{d.title}</h3>
                    <p>
                      Versión {d.version} · Revisión {displayDate(d.reviewDate)}
                    </p>
                  </div>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
            {!studies.length && !documents.length && (
              <EmptyState title="Sin registros documentales" />
            )}
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>EPP asignado</h2>
              <Badge>Asignaciones ficticias</Badge>
            </div>
            {assignments.length ? (
              <div className="related-list">
                {assignments.map((a) => (
                  <Link key={a.id} to={`/epp?registro=${a.ppeId}`}>
                    <div>
                      <h3>{db.ppe.find((p) => p.id === a.ppeId)?.type}</h3>
                      <p>
                        {a.quantity} unidad(es) · {displayDate(a.assignedAt)}
                      </p>
                    </div>
                    <ArrowUpRight size={16} />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Sin asignaciones"
                description="Las asignaciones se registran desde el inventario EPP. No son una recomendación técnica."
                action={<InlineLink to="/epp">Ir al inventario</InlineLink>}
              />
            )}
          </section>
        </div>
        <div className="stack">
          <section className="panel">
            <div className="panel-header">
              <h2>Alertas vinculadas</h2>
              <span className="count-circle">{alerts.length}</span>
            </div>
            {alerts.length ? (
              <div className="related-list">
                {alerts.map((a) => (
                  <Link key={a.id} to={a.path}>
                    <div>
                      <span className="table-sub">
                        {a.sourceType} · {a.severity}
                      </span>
                      <h3>{a.title}</h3>
                    </div>
                    <ArrowUpRight size={15} />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Sin avisos de seguimiento"
                description="Este estado no determina condiciones de operación."
              />
            )}
          </section>
          <section className="panel">
            <div className="panel-header">
              <h2>Actividad del activo</h2>
            </div>
            <div className="activity-list">
              {events.slice(0, 8).map((e) => (
                <Link key={e.id} to={`/hallazgos?registro=${e.findingId}`}>
                  <span className="activity-dot" />
                  <div>
                    <p>{e.text}</p>
                    <span>{displayDate(e.at)}</span>
                  </div>
                </Link>
              ))}
            </div>
            {!events.length && <EmptyState title="Sin actividad registrada" />}
          </section>
        </div>
      </div>
      {create && <FindingEditor assetId={asset.id} onClose={() => setCreate(false)} />}
    </>
  );
}
