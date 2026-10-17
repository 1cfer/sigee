import { NavigationGuard } from '../components/NavigationGuard';
import { useToast } from '../components/toast-context';
import { useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FileText, Pencil } from 'lucide-react';
import { useDatabase } from '../store/useDatabase';
import { displayDate, isPast } from '../domain/dates';
import type { ArcFlashStudy, DocumentRecord } from '../domain/types';
import {
  Badge,
  Confirm,
  EmptyState,
  Field,
  FilterSelect,
  Modal,
  PageHeading,
  SearchInput,
} from '../components/ui';

type RecordSelection =
  { kind: 'estudio'; record: ArcFlashStudy } | { kind: 'documento'; record: DocumentRecord };
function MetadataEditor({
  selection,
  onClose,
}: {
  selection: RecordSelection;
  onClose: () => void;
}) {
  const leaving = useRef(false);
  const exit = () => {
    leaving.current = true;
    onClose();
  };
  const db = useDatabase((s) => s.db);
  const saveStudy = useDatabase((s) => s.saveStudy);
  const saveDocument = useDatabase((s) => s.saveDocument);
  const toast = useToast();
  const [draft, setDraft] = useState(selection.record);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(selection.record);
  const close = () => {
    if (dirty) setDiscard(true);
    else exit();
  };
  const set = (key: string, value: string) => setDraft((prev) => ({ ...prev, [key]: value }));
  const study = 'reference' in draft ? draft : null;
  const doc = 'code' in draft ? draft : null;
  return (
    <Modal
      open
      onClose={close}
      title={study ? study.reference : (doc?.code ?? '')}
      description={
        study
          ? 'Metadatos de un registro documental. No contiene resultados calculados ni certificaciones.'
          : 'Metadatos ficticios. No se generan archivos técnicos ni aprobaciones.'
      }
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if ('reference' in draft) saveStudy(draft.id, draft);
            else saveDocument(draft.id, draft);
            toast('Metadatos actualizados. Seguimiento recalculado.');
            exit();
          } catch {
            setError(
              'Revisa los campos obligatorios, las fechas y el activo. La revisión de un estudio no puede ser anterior a su fecha de registro.',
            );
          }
        }}
      >
        <div className="form-grid">
          <Field label={study ? 'Referencia' : 'Código'} required>
            <input
              value={study ? study.reference : (doc?.code ?? '')}
              onChange={(e) => set(study ? 'reference' : 'code', e.target.value)}
              required
              maxLength={200}
            />
          </Field>
          <Field label="Versión" required>
            <input
              value={draft.version}
              onChange={(e) => set('version', e.target.value)}
              required
              maxLength={200}
            />
          </Field>
          {doc && (
            <>
              <div className="span-2">
                <Field label="Título" required>
                  <input
                    value={doc.title}
                    onChange={(e) => set('title', e.target.value)}
                    required
                    maxLength={200}
                  />
                </Field>
              </div>
              <Field label="Tipo" required>
                <input
                  value={doc.type}
                  onChange={(e) => set('type', e.target.value)}
                  required
                  maxLength={200}
                />
              </Field>
            </>
          )}
          <Field label="Responsable" required>
            <input
              value={draft.responsible}
              onChange={(e) => set('responsible', e.target.value)}
              required
              maxLength={200}
            />
          </Field>
          <Field label="Activo asociado" required={Boolean(study)}>
            <select
              value={draft.assetId ?? ''}
              onChange={(e) => set('assetId', e.target.value)}
              required={Boolean(study)}
            >
              <option value="">{study ? 'Selecciona un activo' : 'Documento general'}</option>
              {db.assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </Field>
          {study && (
            <Field label="Fecha del estudio" required>
              <input
                type="date"
                value={study.studyDate}
                onChange={(e) => set('studyDate', e.target.value)}
                required
              />
            </Field>
          )}
          <Field label="Próxima revisión" required>
            <input
              type="date"
              min={study?.studyDate}
              value={study ? study.nextReview : (doc?.reviewDate ?? '')}
              onChange={(e) => set(study ? 'nextReview' : 'reviewDate', e.target.value)}
              required
            />
          </Field>
          <Field label="Estado documental">
            <select value={draft.status} onChange={(e) => set('status', e.target.value)}>
              <option value="registrado">Registrado</option>
              <option value="pendiente de revisión">Pendiente de revisión</option>
            </select>
          </Field>
        </div>
        {draft.assetId && (
          <p className="form-hint">
            Relacionado con{' '}
            <Link className="text-link" to={`/activos/${draft.assetId}`}>
              {db.assets.find((a) => a.id === draft.assetId)?.code}
            </Link>
          </p>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={close}>
            Cancelar
          </button>
          <button className="button primary" type="submit">
            Guardar metadatos
          </button>
        </div>
      </form>
      <NavigationGuard leaving={leaving} dirty={dirty} />
      <Confirm
        open={discard}
        onClose={() => setDiscard(false)}
        title="Descartar cambios"
        description="Los metadatos modificados todavía no se han guardado."
        label="Descartar"
        onConfirm={exit}
      />
    </Modal>
  );
}

export function Documents() {
  const db = useDatabase((s) => s.db);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(params.has('pendientes') ? 'pendientes' : '');
  const tab = params.get('tipo') === 'documentos' ? 'documentos' : 'estudios';
  const selectedId = params.get('registro');
  const study = tab === 'estudios' ? db.studies.find((s) => s.id === selectedId) : undefined;
  const doc = tab === 'documentos' ? db.documents.find((d) => d.id === selectedId) : undefined;
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'tipo') next.delete('registro');
    setParams(next);
  };
  const studies = db.studies.filter(
    (s) =>
      `${s.reference} ${s.responsible} ${db.assets.find((a) => a.id === s.assetId)?.code}`
        .toLocaleLowerCase('es')
        .includes(search.toLocaleLowerCase('es')) &&
      (!pending || s.status === 'pendiente de revisión' || isPast(s.nextReview)),
  );
  const documents = db.documents.filter(
    (d) =>
      `${d.code} ${d.title} ${d.responsible}`
        .toLocaleLowerCase('es')
        .includes(search.toLocaleLowerCase('es')) &&
      (!pending || d.status === 'pendiente de revisión' || isPast(d.reviewDate)),
  );
  return (
    <>
      <PageHeading
        eyebrow="05 / TRAZABILIDAD DOCUMENTAL"
        title="Estudios y documentos"
        description="Referencias organizadas. Fechas de revisión visibles. Seguimiento conectado."
      />
      <div className="tabs" role="tablist" aria-label="Tipo de registro">
        <button
          id="tab-estudios"
          role="tab"
          aria-controls="document-panel"
          aria-selected={tab === 'estudios'}
          onClick={() => set('tipo', 'estudios')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              set('tipo', 'documentos');
              document.getElementById('tab-documentos')?.focus();
            }
          }}
        >
          Estudios de arco eléctrico<span>{db.studies.length}</span>
        </button>
        <button
          id="tab-documentos"
          role="tab"
          aria-controls="document-panel"
          aria-selected={tab === 'documentos'}
          onClick={() => set('tipo', 'documentos')}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              set('tipo', 'estudios');
              document.getElementById('tab-estudios')?.focus();
            }
          }}
        >
          Gestión documental<span>{db.documents.length}</span>
        </button>
      </div>
      <section
        className="panel table-panel"
        role="tabpanel"
        id="document-panel"
        aria-labelledby={`tab-${tab}`}
      >
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar referencia o responsable…"
          />
          <FilterSelect
            label="Todas las revisiones"
            value={pending}
            onChange={setPending}
            options={[{ value: 'pendientes', label: 'Pendientes de revisión' }]}
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{tab === 'estudios' ? 'Referencia del estudio' : 'Documento'}</th>
                <th>Activo</th>
                <th>Versión</th>
                <th>Responsable</th>
                <th>Próxima revisión</th>
                <th>Seguimiento</th>
                <th>
                  <span className="sr-only">Editar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tab === 'estudios'
                ? studies.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <button className="table-title" onClick={() => set('registro', s.id)}>
                          <FileText size={16} />
                          {s.reference}
                        </button>
                        <span className="table-sub">Estudio: {displayDate(s.studyDate)}</span>
                      </td>
                      <td>
                        <Link className="code-link" to={`/activos/${s.assetId}`}>
                          {db.assets.find((a) => a.id === s.assetId)?.code}
                        </Link>
                      </td>
                      <td>{s.version}</td>
                      <td>{s.responsible}</td>
                      <td>{displayDate(s.nextReview)}</td>
                      <td>
                        <Badge
                          tone={
                            isPast(s.nextReview) || s.status === 'pendiente de revisión'
                              ? 'amber'
                              : 'teal'
                          }
                        >
                          {isPast(s.nextReview) || s.status === 'pendiente de revisión'
                            ? 'Pendiente de revisión'
                            : 'Registrado'}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Editar ${s.reference}`}
                          onClick={() => set('registro', s.id)}
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                : documents.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <button className="table-title" onClick={() => set('registro', d.id)}>
                          {d.title}
                        </button>
                        <span className="table-sub">
                          {d.code} · {d.type}
                        </span>
                      </td>
                      <td>
                        {d.assetId ? (
                          <Link className="code-link" to={`/activos/${d.assetId}`}>
                            {db.assets.find((a) => a.id === d.assetId)?.code}
                          </Link>
                        ) : (
                          'General'
                        )}
                      </td>
                      <td>{d.version}</td>
                      <td>{d.responsible}</td>
                      <td>{displayDate(d.reviewDate)}</td>
                      <td>
                        <Badge
                          tone={
                            isPast(d.reviewDate) || d.status === 'pendiente de revisión'
                              ? 'amber'
                              : 'teal'
                          }
                        >
                          {isPast(d.reviewDate) || d.status === 'pendiente de revisión'
                            ? 'Pendiente de revisión'
                            : 'Registrado'}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Editar ${d.code}`}
                          onClick={() => set('registro', d.id)}
                        >
                          <Pencil size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!(tab === 'estudios' ? studies.length : documents.length) && <EmptyState />}
        <div className="table-footer">
          {tab === 'estudios' ? studies.length : documents.length} registros · Solo metadatos
          ficticios, sin certificación ni aprobación.
        </div>
      </section>
      <div className="context-note">
        <FileText size={17} />
        <p>
          Los estudios son referencias documentales. SIGEE no calcula energía incidente, no
          selecciona EPP y no genera estudios técnicos.
        </p>
      </div>
      {study && (
        <MetadataEditor
          key={study.id}
          selection={{ kind: 'estudio', record: study }}
          onClose={() => set('registro', '')}
        />
      )}
      {doc && (
        <MetadataEditor
          key={doc.id}
          selection={{ kind: 'documento', record: doc }}
          onClose={() => set('registro', '')}
        />
      )}
    </>
  );
}
