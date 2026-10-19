import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileText, History as HistoryIcon, Upload } from 'lucide-react';
import { useDatabase } from '../store/useDatabase';
import { displayDate, today, TIME_ZONE } from '../domain/dates';
import { errorMessage } from '../domain/errors';
import { entityPath, type Attachment, type EntityKind } from '../domain/v2';
import { readFile } from '../persistence/database';
import { downloadBlob } from '../reports/pdf';
import { useToast } from './toast-context';
import { NavigationGuard } from './NavigationGuard';
import { Confirm, EmptyState, Field, Modal, StatusBadge } from './ui';

export function History({ kind, id }: { kind?: EntityKind; id?: string }) {
  const events = useDatabase((s) => s.db.events)
    .filter((e) => (!kind || e.entityType === kind) && (!id || e.entityId === id))
    .sort((a, b) => b.at.localeCompare(a.at));
  return (
    <section className="record-section">
      <h3>
        <HistoryIcon size={16} /> Historial de cambios
      </h3>
      <p className="muted">Registro local de demostración, con responsables declarados.</p>
      <div className="history-list">
        {events.slice(0, 80).map((e) => (
          <article key={e.id}>
            <span className="activity-dot" />
            <div>
              <strong>
                {e.action} · {e.description}
              </strong>
              <time>
                {displayDate(e.at)} ·{' '}
                {new Date(e.at).toLocaleTimeString('es-CO', {
                  timeZone: TIME_ZONE,
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · {e.actor}
              </time>
              {!id && (
                <Link className="text-link" to={entityPath(e.entityType, e.entityId)}>
                  Abrir registro
                </Link>
              )}
              {(e.before || e.after) && (
                <details>
                  <summary>Valores registrados</summary>
                  <pre>{JSON.stringify({ anterior: e.before, nuevo: e.after }, null, 2)}</pre>
                </details>
              )}
            </div>
          </article>
        ))}
      </div>
      {!events.length && (
        <EmptyState
          title="Sin cambios adicionales"
          description="Las próximas operaciones aparecerán aquí."
        />
      )}
    </section>
  );
}

export function ArchiveButton({
  kind,
  id,
  archived,
}: {
  kind: Exclude<EntityKind, 'alert'>;
  id: string;
  archived?: boolean;
}) {
  const [confirm, setConfirm] = useState(false),
    [error, setError] = useState('');
  const toast = useToast();
  return (
    <>
      <button className="button secondary" onClick={() => setConfirm(true)}>
        {archived ? 'Reactivar registro' : 'Archivar registro'}
      </button>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        title={archived ? 'Reactivar registro' : 'Archivar registro'}
        description="Se conservan sus relaciones, archivos e historial. Las bajas administrativas no borran registros."
        onConfirm={() => {
          void useDatabase
            .getState()
            .archive(kind, id)
            .then(() => toast('Estado administrativo actualizado.'))
            .catch((e) => setError(errorMessage(e, 'No se pudo guardar.')));
        }}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function SaveForm({
  children,
  onSave,
  label = 'Guardar cambios',
  onDone,
  protect = true,
}: {
  children: ReactNode;
  onSave: (data: FormData) => Promise<unknown>;
  label?: string;
  onDone?: () => void;
  protect?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (protect && dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', listener);
    return () => window.removeEventListener('beforeunload', listener);
  }, [dirty, protect]);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError('');
    try {
      await onSave(new FormData(form));
      setDirty(false);
      onDone?.();
    } catch (e) {
      setError(errorMessage(e, 'No se pudo guardar.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      data-unsaved={protect && dirty}
      onChange={() => setDirty(true)}
      onSubmit={(e) => void submit(e)}
    >
      {children}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? 'Guardando…' : label}
        </button>
      </div>
    </form>
  );
}

type EditableKind = Exclude<EntityKind, 'finding' | 'alert'>;
export function RecordTabs({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  const [pending, setPending] = useState<string>();
  return (
    <>
      <div className="tabs" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            className={value === option.value ? 'active' : ''}
            onClick={(event) => {
              if (option.value === value) return;
              if (
                event.currentTarget
                  .closest('.dialog-content')
                  ?.querySelector('form[data-unsaved="true"]')
              )
                setPending(option.value);
              else onChange(option.value);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <Confirm
        open={Boolean(pending)}
        onClose={() => setPending(undefined)}
        title="Hay cambios sin guardar"
        description="Cambiar de sección descartará la información pendiente de este formulario."
        label="Descartar y continuar"
        onConfirm={() => {
          if (pending) onChange(pending);
        }}
      />
    </>
  );
}
type Spec = {
  key: string;
  label: string;
  type?: 'textarea' | 'date' | 'number';
  required?: boolean;
  options?: { value: string; label: string }[];
};
const options = (values: string[]) => values.map((value) => ({ value, label: value }));
export function EntityEditor({
  kind,
  id,
  onClose,
  onSaved,
}: {
  kind: EditableKind;
  id?: string;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const db = useDatabase((s) => s.db);
  const table = {
    installation: db.installations,
    asset: db.assets,
    ppe: db.ppe,
    study: db.studies,
    document: db.documents,
  }[kind];
  const row = table.find((r) => r.id === id);
  const original: Record<string, unknown> = {
    code: '',
    name: '',
    location: '',
    description: '',
    responsible: 'Usuario de demostración',
    installationId: '',
    assetId: '',
    type: '',
    nominalVoltage: '',
    administrativeStatus: 'registrado',
    operationalStatus: 'sin verificar',
    reference: '',
    category: '',
    manufacturer: '',
    notes: '',
    initialQuantity: 0,
    nextInspection: '',
    studyDate: today(),
    originalDate: today(),
    nextReview: '',
    reviewDate: '',
    version: '1.0',
    status: 'registrado',
    documentState: 'borrador',
    title: '',
    objective: '',
    scope: '',
    observations: '',
    ...row,
    ...(row && 'technical' in row ? row.technical : {}),
  };
  const [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  const leaving = useRef(false);
  const toast = useToast();
  const installationOptions = db.installations
    .filter((i) => !i.archived || i.id === original.installationId)
    .map((i) => ({ value: i.id, label: `${i.code} · ${i.name}` }));
  const assetOptions = [
    { value: '', label: 'Selecciona un activo' },
    ...db.assets
      .filter((a) => !a.archived || a.id === original.assetId)
      .map((a) => ({ value: a.id, label: `${a.code} · ${a.name}` })),
  ];
  const base: Spec[] = [
    { key: 'code', label: 'Código', required: true },
    { key: 'name', label: 'Nombre', required: true },
    { key: 'responsible', label: 'Responsable', required: true },
    { key: 'description', label: 'Descripción', type: 'textarea' },
  ];
  let fields: Spec[] = [];
  if (kind === 'installation')
    fields = [...base, { key: 'location', label: 'Ubicación general', required: true }];
  if (kind === 'asset')
    fields = [
      ...base,
      {
        key: 'installationId',
        label: 'Instalación',
        required: true,
        options: [{ value: '', label: 'Selecciona una instalación' }, ...installationOptions],
      },
      { key: 'type', label: 'Tipo de equipo', required: true },
      { key: 'nominalVoltage', label: 'Tensión nominal declarada', required: true },
      {
        key: 'administrativeStatus',
        label: 'Estado administrativo',
        options: options(['registrado', 'en revisión']),
      },
      {
        key: 'operationalStatus',
        label: 'Estado operativo declarado',
        options: options([
          'sin verificar',
          'registrado en servicio',
          'registrado fuera de servicio',
          'retirado',
        ]),
      },
    ];
  if (kind === 'ppe')
    fields = [
      { key: 'code', label: 'Código', required: true },
      { key: 'type', label: 'Tipo de EPP', required: true },
      { key: 'reference', label: 'Referencia', required: true },
      { key: 'category', label: 'Categoría', required: true },
      { key: 'manufacturer', label: 'Fabricante' },
      { key: 'location', label: 'Ubicación de almacenamiento', required: true },
      {
        key: 'installationId',
        label: 'Instalación',
        options: [{ value: '', label: 'Sin instalación' }, ...installationOptions],
      },
      { key: 'description', label: 'Descripción', type: 'textarea' },
      { key: 'notes', label: 'Observaciones', type: 'textarea' },
      { key: 'nextInspection', label: 'Próxima inspección', type: 'date' },
      ...(!id
        ? [
            {
              key: 'initialQuantity',
              label: 'Unidades recibidas (pendientes de inspección)',
              type: 'number' as const,
            },
          ]
        : []),
    ];
  const documentary: Spec[] = [
    { key: 'title', label: 'Título', required: true },
    { key: 'assetId', label: 'Activo asociado', required: kind === 'study', options: assetOptions },
    { key: 'version', label: 'Versión declarada', required: true },
    { key: 'responsible', label: 'Responsable', required: true },
    {
      key: 'documentState',
      label: 'Estado documental',
      options: options(['borrador', 'en revisión', 'aprobado administrativamente', 'archivado']),
    },
  ];
  if (kind === 'study')
    fields = [
      { key: 'reference', label: 'Referencia', required: true },
      ...documentary,
      { key: 'studyDate', label: 'Fecha original del estudio', required: true, type: 'date' },
      { key: 'nextReview', label: 'Próxima revisión', type: 'date' },
      ...['objective', 'scope', 'observations'].map((key, i) => ({
        key,
        label: ['Objetivo', 'Alcance', 'Observaciones'][i]!,
        type: 'textarea' as const,
      })),
      ...[
        'nominalVoltage',
        'shortCircuitCurrent',
        'workingDistance',
        'incidentEnergy',
        'arcBoundary',
        'methodology',
        'assumptions',
        'conclusions',
      ].map((key, i) => ({
        key,
        label: [
          'Tensión nominal (referencia)',
          'Corriente de cortocircuito (ilustrativa)',
          'Distancia de trabajo (ilustrativa)',
          'Energía incidente (ilustrativa)',
          'Frontera de arco (ilustrativa)',
          'Metodología declarada',
          'Supuestos',
          'Conclusiones declaradas',
        ][i]!,
        type: 'textarea' as const,
      })),
    ];
  if (kind === 'document')
    fields = [
      { key: 'code', label: 'Código', required: true },
      ...documentary,
      { key: 'type', label: 'Categoría documental', required: true },
      {
        key: 'installationId',
        label: 'Instalación',
        options: [{ value: '', label: 'General' }, ...installationOptions],
      },
      {
        key: 'findingId',
        label: 'Hallazgo relacionado',
        options: [
          { value: '', label: 'Sin hallazgo' },
          ...db.findings.map((f) => ({ value: f.id, label: `${f.code} · ${f.title}` })),
        ],
      },
      { key: 'originalDate', label: 'Fecha original del documento', type: 'date', required: true },
      { key: 'reviewDate', label: 'Próxima revisión', type: 'date' },
      { key: 'description', label: 'Descripción', type: 'textarea' },
    ];
  const exit = () => {
    leaving.current = true;
    onClose();
  };
  const close = () => (dirty ? setDiscard(true) : exit());
  const names = {
    installation: 'instalación',
    asset: 'activo',
    ppe: 'referencia EPP',
    study: 'estudio',
    document: 'documento',
  };
  return (
    <Modal
      open
      onClose={close}
      wide
      title={`${id ? 'Editar' : 'Crear'} ${names[kind]}`}
      description="Los cambios de metadatos no constituyen una revisión técnica."
    >
      <div onChange={() => setDirty(true)}>
        <SaveForm
          protect={false}
          label="Guardar registro"
          onSave={async (data) => {
            const values: Record<string, unknown> = Object.fromEntries(data.entries());
            if (kind === 'ppe' && !id) values.initialQuantity = Number(values.initialQuantity);
            if (kind === 'study') values.originalDate = values.studyDate;
            values.status = original.status;
            const saved = await useDatabase.getState().saveRecord(kind, values, id);
            leaving.current = true;
            toast('Registro guardado en este navegador.');
            onSaved?.(saved);
            exit();
          }}
        >
          <div className="form-grid">
            {fields.map((f) => (
              <Field key={f.key} label={f.label} required={f.required}>
                {f.options ? (
                  <select
                    name={f.key}
                    defaultValue={String(original[f.key] ?? '')}
                    required={f.required}
                  >
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea
                    rows={3}
                    maxLength={3000}
                    name={f.key}
                    defaultValue={String(original[f.key] ?? '')}
                  />
                ) : (
                  <input
                    type={f.type ?? 'text'}
                    name={f.key}
                    defaultValue={String(original[f.key] ?? '')}
                    required={f.required}
                    min={f.type === 'number' ? 0 : undefined}
                    step={f.type === 'number' ? 1 : undefined}
                    maxLength={200}
                  />
                )}
              </Field>
            ))}
          </div>
        </SaveForm>
      </div>
      {discard && (
        <div className="discard-prompt">
          <p>Hay cambios sin guardar.</p>
          <button className="button secondary" onClick={() => setDiscard(false)}>
            Seguir editando
          </button>
          <button className="button danger" onClick={exit}>
            Descartar cambios
          </button>
        </div>
      )}
      <NavigationGuard leaving={leaving} dirty={dirty} />
    </Modal>
  );
}

export function Attachments({ kind, id }: { kind: Attachment['entityType']; id: string }) {
  const rows = useDatabase((s) => s.db.attachments)
    .filter((a) => a.entityType === kind && a.entityId === id)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  const [url, setUrl] = useState(''),
    [selected, setSelected] = useState<Attachment>(),
    [error, setError] = useState('');
  const toast = useToast();
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const open = async (a: Attachment, download = false) => {
    try {
      const blob = await readFile(a.id);
      if (download) downloadBlob(blob, a.name);
      else {
        setUrl(URL.createObjectURL(blob));
        setSelected(a);
      }
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'No se pudo abrir el archivo.'));
    }
  };
  return (
    <section className="record-section">
      <h3>
        <FileText size={16} /> Archivos y versiones
      </h3>
      <p className="muted">
        Persistencia local · Máximo 10 MB por archivo y 50 MB en total. Cada versión conserva su
        archivo.
      </p>
      {rows.length ? (
        <div className="attachment-list">
          {rows.map((a) => (
            <article key={a.id}>
              <FileText size={21} />
              <div>
                <strong>{a.name}</strong>
                <small>
                  Versión {a.version} · {displayDate(a.uploadedAt)} · {(a.size / 1024).toFixed(0)}{' '}
                  KB
                </small>
                <small>{a.notes}</small>
              </div>
              <button className="button secondary" onClick={() => void open(a)}>
                Visualizar
              </button>
              <button
                className="icon-button"
                aria-label={`Descargar ${a.name}`}
                onClick={() => void open(a, true)}
              >
                <Download size={17} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Este registro no tiene archivo"
          description="Adjunta un PDF para consultar el contenido y mantener sus versiones."
        />
      )}
      <details className="upload-box">
        <summary>
          <Upload size={16} /> Adjuntar{' '}
          {kind === 'finding' || kind === 'ppe' ? 'PDF o imagen' : 'PDF'} / nueva versión
        </summary>
        <SaveForm
          label="Guardar archivo"
          onSave={async (data) => {
            const file = data.get('file');
            if (!(file instanceof File)) throw new Error('Selecciona un archivo.');
            await useDatabase
              .getState()
              .upload(kind, id, file, String(data.get('version')), String(data.get('notes')));
            toast('Archivo y versión guardados.');
          }}
        >
          <div className="form-grid">
            <Field label="Archivo" required>
              <input
                name="file"
                type="file"
                accept={
                  kind === 'finding' || kind === 'ppe'
                    ? 'application/pdf,image/png,image/jpeg'
                    : 'application/pdf'
                }
                required
              />
            </Field>
            <Field label="Versión del archivo" required>
              <input name="version" required placeholder="Ej. 2.0" maxLength={200} />
            </Field>
            <Field label="Descripción de la carga">
              <textarea name="notes" maxLength={3000} />
            </Field>
          </div>
        </SaveForm>
      </details>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {selected && (
        <Modal
          open
          wide
          onClose={() => {
            setSelected(undefined);
            setUrl('');
          }}
          title={selected.name}
          description="Archivo guardado localmente. Contenido de demostración sin validación de ingeniería."
        >
          {selected.mime === 'application/pdf' ? (
            <iframe className="pdf-preview" src={url} title={`PDF ${selected.name}`} />
          ) : (
            <img className="attachment-image" src={url} alt={selected.name} />
          )}
          <button className="button secondary" onClick={() => void open(selected, true)}>
            Descargar archivo
          </button>
        </Modal>
      )}
    </section>
  );
}

export function Reviews({ kind, id }: { kind: 'study' | 'document'; id: string }) {
  const rows = useDatabase((s) => s.db.reviews)
    .filter((r) => r.entityType === kind && r.entityId === id)
    .sort((a, b) => b.at.localeCompare(a.at));
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <section className="record-section">
      <div className="section-heading">
        <h3>Revisiones registradas</h3>
        <button className="button secondary" onClick={() => setOpen(true)}>
          Registrar revisión
        </button>
      </div>
      {rows.length ? (
        <div className="history-list">
          {rows.map((r) => (
            <article key={r.id}>
              <span className="activity-dot" />
              <div>
                <strong>
                  {r.responsible} · Versión {r.version}
                </strong>
                <time>
                  {displayDate(r.at)} · Próxima:{' '}
                  {r.nextReview ? displayDate(r.nextReview) : 'Sin programación'}
                </time>
                <p>{r.notes}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">
          Todavía no hay revisiones formales registradas. Editar metadatos no añade una revisión.
        </p>
      )}
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title="Registrar revisión"
          description="Revisión declarada para la demostración. No certifica seguridad ni cumplimiento."
        >
          <SaveForm
            label="Guardar revisión"
            onSave={async (data) => {
              await useDatabase.getState().review(kind, id, {
                date: String(data.get('date')),
                responsible: String(data.get('responsible')),
                notes: String(data.get('notes')),
                nextReview: String(data.get('nextReview')),
              });
              toast('Revisión registrada.');
              setOpen(false);
            }}
          >
            <div className="form-grid">
              <Field label="Fecha de revisión" required>
                <input type="date" name="date" max={today()} defaultValue={today()} required />
              </Field>
              <Field label="Responsable de revisión" required>
                <input name="responsible" required maxLength={200} />
              </Field>
              <Field label="Alcance y observaciones" required>
                <textarea name="notes" required maxLength={3000} />
              </Field>
              <Field label="Próxima revisión">
                <input type="date" name="nextReview" />
              </Field>
            </div>
          </SaveForm>
        </Modal>
      )}
    </section>
  );
}

export function RecordState({ archived, provenance }: { archived?: boolean; provenance: string }) {
  return (
    <div className="detail-badges">
      <StatusBadge status={archived ? 'Archivado' : 'Activo'} />
      <span className="muted">Origen: {provenance}</span>
    </div>
  );
}
