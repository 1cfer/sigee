import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useDatabase } from '../store/useDatabase';
import { today, displayDate } from '../domain/dates';
import { inventoryReasons } from '../domain/analysis';
import { UNAVAILABLE_REASONS, type UnavailableReason } from '../domain/v2';
import {
  ArchiveButton,
  Attachments,
  EntityEditor,
  History,
  RecordState,
  RecordTabs,
  SaveForm,
} from '../components/RecordTools';
import { Badge, EmptyState, Field, Modal, PageHeading, SearchInput } from '../components/ui';
import { useToast } from '../components/toast-context';

export function PPE() {
  const db = useDatabase((s) => s.db);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(''),
    [showArchived, setArchived] = useState(false),
    [edit, setEdit] = useState<{ id?: string }>(),
    [tab, setTab] = useState('consulta'),
    [movementType, setMovementType] = useState<
      'entrada' | 'inspección' | 'cambio de estado' | 'corrección' | 'baja'
    >('entrada');
  const toast = useToast();
  const selected = db.ppe.find((p) => p.id === params.get('registro'));
  const rows = db.ppe.filter(
    (p) =>
      (showArchived || !p.archived) &&
      `${p.code} ${p.type} ${p.reference} ${p.category}`
        .toLocaleLowerCase('es')
        .includes(search.toLocaleLowerCase('es')),
  );
  const open = (id: string) => {
    setParams({ registro: id });
    setTab('consulta');
  };
  const assigned = (id: string) =>
    db.assignments
      .filter((a) => a.ppeId === id && !a.returnedAt)
      .reduce((s, a) => s + a.quantity, 0);
  return (
    <>
      <PageHeading
        eyebrow="04 / RECURSOS Y MOVIMIENTOS"
        title="Inventario EPP"
        description="Disponibilidad explicable: cada unidad conserva su estado y sus movimientos."
        actions={
          <button className="button primary" onClick={() => setEdit({})}>
            <Plus size={16} />
            Crear referencia EPP
          </button>
        }
      />
      <section className="panel table-panel">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar tipo, código o referencia EPP…"
          />
          <label className="check-label">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            Incluir archivados
          </label>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Referencia EPP</th>
                <th>Total</th>
                <th>Disponibles</th>
                <th>Asignadas</th>
                <th>No disponibles</th>
                <th>Próxima inspección</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <button className="table-title" onClick={() => open(p.id)}>
                      {p.type}
                    </button>
                    <span className="table-sub">
                      {p.code} · {p.reference}
                    </span>
                  </td>
                  <td>{p.total}</td>
                  <td>
                    <Badge tone="teal">{p.available}</Badge>
                  </td>
                  <td>{assigned(p.id)}</td>
                  <td>
                    <Badge tone={p.unavailable ? 'amber' : 'neutral'}>{p.unavailable}</Badge>
                  </td>
                  <td>
                    {p.nextInspection ? displayDate(p.nextInspection) : 'Sin fecha programada'}
                    <span className="table-sub">{p.inspectionStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <EmptyState
            title="Sin referencias en esta vista"
            description="Crea una referencia EPP para registrar entradas y controlar sus estados."
            action={
              <button className="button primary" onClick={() => setEdit({})}>
                Crear referencia EPP
              </button>
            }
          />
        )}
        <div className="table-footer">
          {rows.length} referencias · Total = disponibles + asignadas + no disponibles
        </div>
      </section>
      <div className="context-note">
        La disponibilidad es administrativa. No determina la idoneidad técnica de un EPP para una
        tarea.
      </div>
      {selected && (
        <Modal
          open
          wide
          onClose={() => setParams({})}
          title={`${selected.code} · ${selected.type}`}
          description="Ficha de inventario y trazabilidad de unidades."
        >
          <div className="record-body">
            <RecordState archived={selected.archived} provenance={selected.provenance} />
            <div className="inventory-balances">
              {[
                ['Total', selected.total],
                ['Disponibles', selected.available],
                ['Asignadas', assigned(selected.id)],
                ['No disponibles', selected.unavailable],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong data-testid={`balance-${label}`}>{value}</strong>
                </div>
              ))}
            </div>
            <RecordTabs
              value={tab}
              onChange={setTab}
              label="Ficha EPP"
              options={['consulta', 'movimientos', 'asignaciones', 'archivos', 'historial'].map(
                (value) => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }),
              )}
            />
            {tab === 'consulta' && (
              <>
                <dl className="detail-grid">
                  {[
                    ['Referencia', selected.reference],
                    ['Categoría', selected.category],
                    ['Fabricante', selected.manufacturer || 'Sin registrar'],
                    ['Ubicación', selected.location],
                    [
                      'Última inspección',
                      selected.lastInspection
                        ? displayDate(selected.lastInspection)
                        : 'Sin registro formal',
                    ],
                    [
                      'Próxima inspección',
                      selected.nextInspection
                        ? displayDate(selected.nextInspection)
                        : 'Sin fecha programada',
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <p>{selected.description}</p>
                <p>{selected.notes}</p>
                <h3>Motivos de no disponibilidad</h3>
                <div className="reason-grid">
                  {UNAVAILABLE_REASONS.map((reason) => (
                    <div key={reason}>
                      <span>{reason}</span>
                      <strong>{inventoryReasons(db, selected.id)[reason] ?? 0}</strong>
                    </div>
                  ))}
                </div>
                <div className="detail-actions">
                  <button className="button secondary" onClick={() => setEdit({ id: selected.id })}>
                    Editar referencia
                  </button>
                  <ArchiveButton kind="ppe" id={selected.id} archived={selected.archived} />
                  <button className="button primary" onClick={() => setTab('movimientos')}>
                    Registrar movimiento
                  </button>
                </div>
              </>
            )}
            {tab === 'movimientos' && (
              <>
                <h3>Registrar movimiento</h3>
                <SaveForm
                  label="Guardar movimiento"
                  onSave={async (data) => {
                    await useDatabase.getState().movePPE(selected.id, {
                      type: movementType,
                      quantity: Number(data.get('quantity')),
                      from: String(data.get('from') || 'disponible') as
                        'disponible' | UnavailableReason,
                      to: String(data.get('to')) as 'disponible' | UnavailableReason,
                      responsible: String(data.get('responsible')),
                      source: String(data.get('source')),
                      notes: String(data.get('notes')),
                      date: String(data.get('date')),
                      nextInspection: String(data.get('nextInspection') ?? ''),
                    });
                    toast('Movimiento guardado; saldos actualizados.');
                  }}
                >
                  <div className="form-grid">
                    <Field label="Tipo de movimiento">
                      <select
                        value={movementType}
                        onChange={(e) => setMovementType(e.target.value as typeof movementType)}
                      >
                        {['entrada', 'inspección', 'cambio de estado', 'corrección', 'baja'].map(
                          (t) => (
                            <option key={t}>{t}</option>
                          ),
                        )}
                      </select>
                    </Field>
                    <Field label="Unidades del movimiento" required>
                      <input
                        name="quantity"
                        type="number"
                        min={1}
                        step={1}
                        required
                        defaultValue={1}
                      />
                    </Field>
                    {movementType !== 'entrada' && (
                      <Field label="Estado de origen">
                        <select name="from" defaultValue="pendiente de inspección">
                          {['disponible', ...UNAVAILABLE_REASONS].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field label="Estado de destino">
                      <select
                        name="to"
                        key={movementType}
                        defaultValue={
                          movementType === 'inspección'
                            ? 'disponible'
                            : movementType === 'baja'
                              ? 'dado de baja'
                              : 'pendiente de inspección'
                        }
                      >
                        {[
                          ...(movementType === 'entrada' ? [] : ['disponible']),
                          ...UNAVAILABLE_REASONS,
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Fecha del movimiento" required>
                      <input
                        name="date"
                        type="date"
                        defaultValue={today()}
                        max={today()}
                        required
                      />
                    </Field>
                    {movementType === 'inspección' && (
                      <Field label="Programar próxima inspección">
                        <input type="date" name="nextInspection" min={today()} />
                      </Field>
                    )}
                    <Field label="Responsable del movimiento" required>
                      <input name="responsible" required maxLength={200} />
                    </Field>
                    <Field label="Procedencia o referencia" required>
                      <input name="source" required maxLength={200} />
                    </Field>
                    <Field label="Motivo y observaciones" required>
                      <textarea name="notes" required maxLength={3000} />
                    </Field>
                  </div>
                  <p className="muted">
                    Las entradas quedan no disponibles. Una inspección documentada puede trasladar
                    unidades a disponibles. Las correcciones requieren un motivo y conservan el
                    movimiento original.
                  </p>
                </SaveForm>
                <h3 className="subheading">Libro de movimientos</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha / tipo</th>
                        <th>Unidades</th>
                        <th>Variación disponibles</th>
                        <th>Variación asignadas</th>
                        <th>Motivo / responsable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {db.movements
                        .filter((m) => m.ppeId === selected.id)
                        .sort((a, b) => b.at.localeCompare(a.at))
                        .map((m) => (
                          <tr key={m.id}>
                            <td>
                              {displayDate(m.at)}
                              <span className="table-sub">{m.type}</span>
                            </td>
                            <td>{m.quantity}</td>
                            <td>
                              {m.availableDelta > 0 ? '+' : ''}
                              {m.availableDelta}
                            </td>
                            <td>
                              {m.assignedDelta > 0 ? '+' : ''}
                              {m.assignedDelta}
                            </td>
                            <td>
                              {m.notes}
                              <span className="table-sub">
                                {m.responsible} · {m.source}
                              </span>
                              <span className="table-sub">
                                {Object.entries(m.unavailableDelta)
                                  .map(([r, n]) => `${r}: ${n! > 0 ? '+' : ''}${n}`)
                                  .join(' · ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {tab === 'asignaciones' && (
              <>
                <h3>Asignar unidades disponibles</h3>
                <SaveForm
                  label="Asignar unidades"
                  onSave={async (data) => {
                    await useDatabase
                      .getState()
                      .assignPPE(
                        selected.id,
                        String(data.get('assetId')),
                        Number(data.get('quantity')),
                        {
                          responsible: String(data.get('responsible')),
                          activity: String(data.get('activity')),
                          expectedReturn: String(data.get('expectedReturn')),
                          notes: String(data.get('notes')),
                        },
                      );
                    toast('Asignación guardada.');
                  }}
                >
                  <div className="form-grid">
                    <Field label="Activo de destino" required>
                      <select name="assetId" required>
                        <option value="">Selecciona un activo</option>
                        {db.assets
                          .filter((a) => !a.archived)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} · {a.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Unidades a asignar" required>
                      <input
                        name="quantity"
                        type="number"
                        min={1}
                        max={selected.available}
                        required
                        defaultValue={1}
                      />
                    </Field>
                    <Field label="Responsable de asignación" required>
                      <input name="responsible" required maxLength={200} />
                    </Field>
                    <Field label="Actividad" required>
                      <input name="activity" required maxLength={200} />
                    </Field>
                    <Field label="Devolución prevista">
                      <input type="date" name="expectedReturn" min={today()} />
                    </Field>
                    <Field label="Observaciones de asignación">
                      <textarea name="notes" maxLength={3000} />
                    </Field>
                  </div>
                </SaveForm>
                <h3 className="subheading">Asignaciones e historial de devoluciones</h3>
                {db.assignments
                  .filter((a) => a.ppeId === selected.id)
                  .map((a) => (
                    <article className="assignment-row" key={a.id}>
                      <p>
                        <Link className="text-link" to={`/activos/${a.assetId}`}>
                          {db.assets.find((r) => r.id === a.assetId)?.code}
                        </Link>{' '}
                        · {a.quantity} unidades · {a.responsible}
                        <span className="table-sub">
                          {a.activity} · {displayDate(a.assignedAt)}
                          {a.expectedReturn && ` · Prevista ${displayDate(a.expectedReturn)}`}
                        </span>
                      </p>
                      {a.returnedAt ? (
                        <Badge tone="teal">Devuelto · {displayDate(a.returnedAt)}</Badge>
                      ) : (
                        <SaveForm
                          label="Registrar devolución"
                          onSave={async (data) => {
                            await useDatabase
                              .getState()
                              .releaseAssignment(
                                a.id,
                                String(data.get('condition')) as 'disponible' | UnavailableReason,
                              );
                            toast('Devolución guardada con el estado de recepción.');
                          }}
                        >
                          <Field label={`Estado de recepción ${a.id}`}>
                            <select name="condition" defaultValue="pendiente de inspección">
                              {['disponible', ...UNAVAILABLE_REASONS].map((t) => (
                                <option key={t}>{t}</option>
                              ))}
                            </select>
                          </Field>
                        </SaveForm>
                      )}
                    </article>
                  ))}
              </>
            )}
            {tab === 'archivos' && <Attachments kind="ppe" id={selected.id} />}{' '}
            {tab === 'historial' && <History kind="ppe" id={selected.id} />}
          </div>
        </Modal>
      )}
      {edit && (
        <EntityEditor kind="ppe" id={edit.id} onClose={() => setEdit(undefined)} onSaved={open} />
      )}
    </>
  );
}
