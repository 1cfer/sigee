import { errorMessage } from '../domain/errors';
import { NavigationGuard } from '../components/NavigationGuard';
import { useToast } from '../components/toast-context';
import { useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, ShieldCheck } from 'lucide-react';
import { useDatabase } from '../store/useDatabase';
import { displayDate, isPast } from '../domain/dates';
import { ppeSchema } from '../domain/validation';
import type { PPEItem } from '../domain/types';
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

function PPEEditor({ item, onClose }: { item: PPEItem; onClose: () => void }) {
  const leaving = useRef(false);
  const exit = () => {
    leaving.current = true;
    onClose();
  };
  const db = useDatabase((s) => s.db);
  const save = useDatabase((s) => s.savePPE);
  const assign = useDatabase((s) => s.assignPPE);
  const release = useDatabase((s) => s.releaseAssignment);
  const toast = useToast();
  const [error, setError] = useState('');
  const [assetId, setAssetId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [discard, setDiscard] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<Omit<PPEItem, 'id' | 'code'>>({
    resolver: zodResolver(ppeSchema),
    defaultValues: item,
  });
  const assigned = db.assignments.filter((a) => a.ppeId === item.id);
  const close = () => {
    if (isDirty) setDiscard(true);
    else exit();
  };
  return (
    <Modal
      open
      onClose={close}
      title={`${item.code} · ${item.type}`}
      description="Inventario y asignaciones ficticias. Sin selección automática ni recomendación de EPP."
      wide
    >
      <form
        onSubmit={handleSubmit((values) => {
          try {
            save(item.id, values);
            reset(values);
            setError('');
            toast('Inventario actualizado.');
          } catch (e) {
            setError(errorMessage(e, 'Revisa las cantidades.'));
          }
        })}
      >
        <div className="form-grid">
          <Field label="Tipo de EPP" required error={errors.type?.message}>
            <input {...register('type')} />
          </Field>
          <Field label="Referencia" required error={errors.reference?.message}>
            <input {...register('reference')} />
          </Field>
          <Field label="Cantidad total" required error={errors.total?.message}>
            <input type="number" min="0" {...register('total', { valueAsNumber: true })} />
          </Field>
          <Field label="Cantidad disponible" required error={errors.available?.message}>
            <input type="number" min="0" {...register('available', { valueAsNumber: true })} />
          </Field>
          <Field label="Cantidad no disponible" required error={errors.unavailable?.message}>
            <input type="number" min="0" {...register('unavailable', { valueAsNumber: true })} />
          </Field>
          <Field label="Unidades asignadas">
            <input readOnly value={assigned.reduce((sum, a) => sum + a.quantity, 0)} />
          </Field>
          <Field label="Próxima inspección" required error={errors.nextInspection?.message}>
            <input type="date" {...register('nextInspection')} />
          </Field>
          <Field label="Estado de inspección">
            <select {...register('inspectionStatus')}>
              <option value="registrada">Registrada</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </Field>
          <div className="span-2">
            <Field label="Observaciones" error={errors.notes?.message}>
              <textarea rows={2} {...register('notes')} />
            </Field>
          </div>
        </div>
        <p className="form-hint">
          Total = disponibles + no disponibles + asignadas. Las asignaciones reservan unidades del
          inventario.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={close}>
            Cerrar
          </button>
          <button className="button primary" type="submit">
            Guardar inventario
          </button>
        </div>
      </form>
      <div className="assignment-section">
        <h3>Asignaciones ficticias</h3>
        {assigned.map((a) => (
          <div className="assignment-row" key={a.id}>
            <Link to={`/activos/${a.assetId}`}>
              {db.assets.find((asset) => asset.id === a.assetId)?.code}
            </Link>
            <span>{a.quantity} unidad(es)</span>
            <button
              className="text-link"
              disabled={isDirty}
              onClick={() => {
                try {
                  release(a.id);
                  reset({ ...item, available: item.available + a.quantity });
                  toast('Unidades devueltas al inventario.');
                  setError('');
                } catch (e) {
                  setError(errorMessage(e, 'No se pudo devolver.'));
                }
              }}
            >
              Devolver
            </button>
          </div>
        ))}
        <form
          className="assignment-form"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              assign(item.id, assetId, quantity);
              reset({ ...item, available: item.available - quantity });
              setError('');
              toast('Asignación registrada. Disponibilidad actualizada.');
            } catch (e) {
              setError(errorMessage(e, 'No se pudo asignar.'));
            }
          }}
        >
          <Field label="Activo de destino" required>
            <select value={assetId} onChange={(e) => setAssetId(e.target.value)} required>
              <option value="">Selecciona un activo</option>
              {db.assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} · {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Unidades" required>
            <input
              type="number"
              min="1"
              max={item.available}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              required
            />
          </Field>
          <button disabled={isDirty} className="button secondary" type="submit">
            Asignar
          </button>
        </form>
        {isDirty && (
          <p className="form-hint">
            Guarda los cambios de inventario antes de gestionar asignaciones.
          </p>
        )}
      </div>
      <NavigationGuard leaving={leaving} dirty={isDirty} />
      <Confirm
        open={discard}
        onClose={() => setDiscard(false)}
        title="Descartar cambios"
        description="Hay cambios en el inventario sin guardar."
        label="Descartar"
        onConfirm={exit}
      />
    </Modal>
  );
}

export function PPE() {
  const db = useDatabase((s) => s.db);
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(params.has('pendientes') ? 'pendiente' : '');
  const selected = db.ppe.find((p) => p.id === params.get('registro'));
  const filtered = db.ppe.filter(
    (p) =>
      `${p.code} ${p.type} ${p.reference}`
        .toLocaleLowerCase('es')
        .includes(search.toLocaleLowerCase('es')) &&
      (!status ||
        (status === 'pendiente'
          ? isPast(p.nextInspection) || p.inspectionStatus === 'pendiente'
          : !isPast(p.nextInspection) && p.inspectionStatus === 'registrada')),
  );
  const open = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set('registro', id);
    else next.delete('registro');
    setParams(next);
  };
  return (
    <>
      <PageHeading
        eyebrow="04 / RECURSOS DE DEMOSTRACIÓN"
        title="Inventario EPP"
        description="Disponibilidad, asignaciones e inspecciones en un mismo registro."
      />
      <div className="small-summary">
        <ShieldCheck size={18} />
        <strong>{db.ppe.length} referencias</strong>
        <span>{db.ppe.reduce((sum, p) => sum + p.available, 0)} unidades disponibles</span>
        <Badge tone="amber">
          {
            db.ppe.filter((p) => isPast(p.nextInspection) || p.inspectionStatus === 'pendiente')
              .length
          }{' '}
          inspecciones pendientes
        </Badge>
      </div>
      <section className="panel table-panel">
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar EPP, código o referencia…"
          />
          <FilterSelect
            label="Todas las inspecciones"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'pendiente', label: 'Pendientes' },
              { value: 'registrada', label: 'Sin pendientes' },
            ]}
          />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Elemento de protección</th>
                <th>Total</th>
                <th>Disponibles</th>
                <th>No disponibles</th>
                <th>Asignadas</th>
                <th>Próxima inspección</th>
                <th>Seguimiento</th>
                <th>
                  <span className="sr-only">Editar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
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
                    <strong className="teal-text">{p.available}</strong>
                  </td>
                  <td>{p.unavailable}</td>
                  <td>
                    {db.assignments
                      .filter((a) => a.ppeId === p.id)
                      .reduce((sum, a) => sum + a.quantity, 0)}
                  </td>
                  <td>{displayDate(p.nextInspection)}</td>
                  <td>
                    <Badge
                      tone={
                        isPast(p.nextInspection) || p.inspectionStatus === 'pendiente'
                          ? 'amber'
                          : 'teal'
                      }
                    >
                      {isPast(p.nextInspection) || p.inspectionStatus === 'pendiente'
                        ? 'Pendiente'
                        : 'Registrada'}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Editar ${p.code}`}
                      onClick={() => open(p.id)}
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
          {filtered.length} referencias · Inventario ficticio, sin recomendaciones de uso.
        </div>
      </section>
      {selected && <PPEEditor item={selected} onClose={() => open('')} />}
    </>
  );
}
