import { Attachments, History } from '../components/RecordTools';
import { errorMessage } from '../domain/errors';
import { useToast } from '../components/toast-context';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownToLine, MessageSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDatabase } from '../store/useDatabase';
import { displayDate, isPast, TIME_ZONE } from '../domain/dates';
import { downloadCSV } from '../domain/export';
import type { Finding } from '../domain/types';
import { FindingEditor } from '../components/FindingEditor';
import {
  Badge,
  Confirm,
  EmptyState,
  FilterSelect,
  Modal,
  PageHeading,
  PriorityBadge,
  SearchInput,
  StatusBadge,
} from '../components/ui';

export function Findings() {
  const db = useDatabase((s) => s.db);
  const remove = useDatabase((s) => s.removeFinding);
  const addComment = useDatabase((s) => s.addComment);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Finding | 'new' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const toast = useToast();
  const state = params.get('estado') ?? '';
  const priority = params.get('prioridad') ?? '';
  const selected = db.findings.find((f) => f.id === params.get('registro'));
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };
  const filtered = db.findings
    .filter((f) => {
      const asset = db.assets.find((a) => a.id === f.assetId);
      return (
        !f.archived &&
        `${f.code} ${f.title} ${f.responsible} ${asset?.name} ${asset?.code}`
          .toLocaleLowerCase('es')
          .includes(search.toLocaleLowerCase('es')) &&
        (!priority || f.priority === priority) &&
        (!state ||
          (state === 'pendientes'
            ? f.status !== 'cerrado'
            : state === 'vencidos'
              ? f.status !== 'cerrado' && isPast(f.dueDate)
              : f.status === state))
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const events = db.findingEvents
    .filter((e) => e.findingId === selected?.id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const fieldNames: Record<string, string> = {
    title: 'Título',
    description: 'Descripción',
    assetId: 'Activo',
    priority: 'Prioridad',
    status: 'Estado',
    responsible: 'Responsable',
    dueDate: 'Fecha objetivo',
  };
  return (
    <>
      <PageHeading
        eyebrow="03 / SEGUIMIENTO"
        title="Hallazgos"
        description="De la observación a la acción. Cada cambio conserva su trazabilidad."
        actions={
          <>
            <button
              className="button secondary"
              onClick={() =>
                downloadCSV(
                  'sigee-hallazgos.csv',
                  [
                    'Código',
                    'Título',
                    'Activo',
                    'Prioridad',
                    'Estado',
                    'Responsable',
                    'Fecha objetivo',
                    'Datos',
                  ],
                  filtered.map((f) => [
                    f.code,
                    f.title,
                    db.assets.find((a) => a.id === f.assetId)?.code ?? '',
                    f.priority,
                    f.status,
                    f.responsible,
                    f.dueDate,
                    'Simulados',
                  ]),
                )
              }
            >
              <ArrowDownToLine size={16} />
              Exportar CSV
            </button>
            <button className="button primary" onClick={() => setEditing('new')}>
              <Plus size={17} />
              Crear hallazgo
            </button>
          </>
        }
      />
      <section className="panel table-panel">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar hallazgo, activo o responsable…"
          />
          <div className="toolbar-filters">
            <FilterSelect
              label="Todos los estados"
              value={state}
              onChange={(v) => setFilter('estado', v)}
              options={[
                'abierto',
                'en progreso',
                'pendiente de verificación',
                'cerrado',
                'pendientes',
                'vencidos',
              ].map((v) => ({
                value: v,
                label: v,
              }))}
            />
            <FilterSelect
              label="Todas las prioridades"
              value={priority}
              onChange={(v) => setFilter('prioridad', v)}
              options={['alta', 'media', 'baja'].map((v) => ({ value: v, label: v }))}
            />
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Hallazgo</th>
                <th>Activo</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th>Fecha objetivo</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id}>
                  <td>
                    <button className="table-title" onClick={() => setFilter('registro', f.id)}>
                      {f.title}
                    </button>
                    <span className="table-sub">{f.code}</span>
                  </td>
                  <td>
                    <Link className="code-link" to={`/activos/${f.assetId}`}>
                      {db.assets.find((a) => a.id === f.assetId)?.code}
                    </Link>
                  </td>
                  <td>
                    <PriorityBadge priority={f.priority} />
                  </td>
                  <td>
                    <StatusBadge status={f.status} />
                  </td>
                  <td>{f.responsible}</td>
                  <td>
                    <span
                      className={f.status !== 'cerrado' && isPast(f.dueDate) ? 'overdue-text' : ''}
                    >
                      {displayDate(f.dueDate)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Editar ${f.code}`}
                      onClick={() => setEditing(f)}
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <EmptyState />}
        <div className="table-footer">
          {filtered.length} de {db.findings.length} hallazgos · Datos simulados
        </div>
      </section>
      {params.has('registro') && !selected && (
        <div className="context-note">
          El hallazgo ya no existe.{' '}
          <button className="text-link" onClick={() => setFilter('registro', '')}>
            Volver al listado
          </button>
        </div>
      )}
      {selected && (
        <Modal
          open
          onClose={() => {
            setFilter('registro', '');
            setComment('');
            setError('');
          }}
          title={selected.code}
          description="Detalle y trazabilidad del hallazgo ficticio."
          wide
        >
          <div className="finding-detail">
            <div className="detail-badges">
              <PriorityBadge priority={selected.priority} />
              <StatusBadge status={selected.status} />
              {selected.status !== 'cerrado' && isPast(selected.dueDate) && (
                <Badge tone="amber">Vencido</Badge>
              )}
            </div>
            <h2>{selected.title}</h2>
            <p className="detail-description">
              {selected.description || 'Sin descripción adicional.'}
            </p>
            <dl className="detail-grid">
              <div>
                <dt>Activo asociado</dt>
                <dd>
                  <Link className="text-link" to={`/activos/${selected.assetId}`}>
                    {db.assets.find((a) => a.id === selected.assetId)?.code}
                  </Link>
                </dd>
              </div>
              <div>
                <dt>Responsable</dt>
                <dd>{selected.responsible}</dd>
              </div>
              <div>
                <dt>Fecha de creación</dt>
                <dd>{displayDate(selected.createdAt)}</dd>
              </div>
              <div>
                <dt>Fecha objetivo</dt>
                <dd>{displayDate(selected.dueDate)}</dd>
              </div>
              {selected.closedAt && (
                <div>
                  <dt>Fecha de cierre</dt>
                  <dd>{displayDate(selected.closedAt)}</dd>
                </div>
              )}
            </dl>
            <div className="detail-actions">
              <button className="button secondary" onClick={() => setEditing(selected)}>
                <Pencil size={15} />
                Editar hallazgo
              </button>
              <button className="button text-danger" onClick={() => setDeleting(true)}>
                <Trash2 size={15} />
                Archivar
              </button>
            </div>
            <dl className="detail-grid">
              <div>
                <dt>Acción correctiva</dt>
                <dd>{selected.correctiveAction || 'Sin registrar'}</dd>
              </div>
              <div>
                <dt>Justificación del cierre</dt>
                <dd>{selected.closureJustification || 'Sin registrar'}</dd>
              </div>
            </dl>
            <Attachments kind="finding" id={selected.id} />
            <History kind="finding" id={selected.id} />
            <h3 className="subheading">Seguimiento y comentarios</h3>
            <div className="history-list">
              {events.map((e) => (
                <article key={e.id}>
                  <span className="activity-dot" />
                  <div>
                    <strong>{e.text}</strong>
                    <time>
                      {displayDate(e.at)} ·{' '}
                      {new Date(e.at).toLocaleTimeString('es-CO', {
                        timeZone: TIME_ZONE,
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                    {e.changes?.map((c) => (
                      <p key={c.field}>
                        {fieldNames[c.field] ?? c.field}: <span>{c.before || 'Sin valor'}</span> →{' '}
                        <b>{c.after || 'Sin valor'}</b>
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <form
              className="comment-form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await addComment(selected.id, comment);
                  setComment('');
                  setError('');
                  toast('Comentario registrado.');
                } catch (e) {
                  setError(errorMessage(e, 'Revisa el comentario.'));
                }
              }}
            >
              <label className="field">
                <span>Añadir comentario</span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  maxLength={3000}
                  required
                />
              </label>
              {error && (
                <p role="alert" className="field-error">
                  {error}
                </p>
              )}
              <button className="button secondary" type="submit">
                <MessageSquare size={15} />
                Registrar comentario
              </button>
            </form>
          </div>
        </Modal>
      )}
      {editing && (
        <FindingEditor
          finding={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            if (editing === 'new') setFilter('registro', id);
          }}
        />
      )}
      <Confirm
        open={deleting && Boolean(selected)}
        onClose={() => setDeleting(false)}
        title="Archivar hallazgo"
        description="Se conserva el hallazgo con sus comentarios e historial. Dejará de formar parte de los pendientes activos."
        label="Archivar hallazgo"
        danger
        onConfirm={() => {
          if (selected)
            void remove(selected.id)
              .then(() => {
                setFilter('registro', '');
                toast('Hallazgo archivado; historial conservado.');
              })
              .catch((e) => setError(errorMessage(e, 'No se pudo archivar.')));
        }}
      />
    </>
  );
}
