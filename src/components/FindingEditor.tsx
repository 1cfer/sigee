import { errorMessage } from '../domain/errors';
import { NavigationGuard } from './NavigationGuard';
import { useToast } from './toast-context';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDatabase } from '../store/useDatabase';
import { findingSchema } from '../domain/validation';
import { calendarDate, today } from '../domain/dates';
import type { Finding, FindingInput } from '../domain/types';
import { Field, Modal } from './ui';

export function FindingEditor({
  finding,
  assetId,
  onClose,
  onSaved,
}: {
  finding?: Finding;
  assetId?: string;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const assets = useDatabase((s) => s.db.assets);
  const save = useDatabase((s) => s.saveFinding);
  const leaving = useRef(false);
  const exit = () => {
    leaving.current = true;
    onClose();
  };
  const toast = useToast();
  const [error, setError] = useState('');
  const [correctiveAction, setAction] = useState(
    String(finding && 'correctiveAction' in finding ? finding.correctiveAction : ''),
  );
  const [closureJustification, setJustification] = useState(
    String(finding && 'closureJustification' in finding ? finding.closureJustification : ''),
  );
  const [extraDirty, setExtraDirty] = useState(false);
  const [discard, setDiscard] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FindingInput>({
    resolver: zodResolver(findingSchema),
    defaultValues: finding ?? {
      assetId: assetId ?? '',
      title: '',
      description: '',
      priority: 'media',
      status: 'abierto',
      responsible: '',
      dueDate: today(),
    },
  });
  const close = () => {
    if (isDirty || extraDirty) setDiscard(true);
    else exit();
  };
  return (
    <Modal
      open
      onClose={close}
      title={finding ? `Editar ${finding.code}` : 'Crear hallazgo'}
      description="Registra una observación ficticia y asigna su seguimiento."
      wide
    >
      <form
        onSubmit={(event) => {
          void handleSubmit(async (values) => {
            try {
              const id = await save(
                { ...values, correctiveAction, closureJustification },
                finding?.id,
              );
              toast(
                finding
                  ? 'Hallazgo actualizado.'
                  : 'Hallazgo creado. Indicadores y alertas actualizados.',
              );
              leaving.current = true;
              onSaved?.(id);
              exit();
            } catch (e) {
              setError(errorMessage(e, 'No se pudo guardar el hallazgo.'));
            }
          })(event);
        }}
      >
        <div className="form-grid">
          <div className="span-2">
            <Field label="Título" required error={errors.title?.message}>
              <input {...register('title')} maxLength={200} autoFocus />
            </Field>
          </div>
          <div className="span-2">
            <Field label="Activo asociado" required error={errors.assetId?.message}>
              <select {...register('assetId')}>
                <option value="">Selecciona un activo</option>
                {assets
                  .filter((a) => !a.archived || a.id === finding?.assetId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <div className="span-2">
            <Field label="Descripción" error={errors.description?.message}>
              <textarea rows={3} {...register('description')} />
            </Field>
          </div>
          <Field label="Prioridad" required>
            <select {...register('priority')}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </Field>
          <Field label="Estado" required>
            <select {...register('status')}>
              <option value="abierto">Abierto</option>
              <option value="en progreso">En progreso</option>
              <option value="pendiente de verificación">Pendiente de verificación</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </Field>
          <Field label="Responsable" required error={errors.responsible?.message}>
            <input {...register('responsible')} maxLength={200} />
          </Field>
          <Field label="Fecha objetivo" required error={errors.dueDate?.message}>
            <input
              type="date"
              min={finding ? calendarDate(finding.createdAt) : today()}
              {...register('dueDate')}
            />
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Acción correctiva (obligatoria al cerrar)">
            <textarea
              value={correctiveAction}
              maxLength={3000}
              onChange={(e) => {
                setAction(e.target.value);
                setExtraDirty(true);
              }}
            />
          </Field>
          <Field label="Justificación del cierre (obligatoria al cerrar)">
            <textarea
              value={closureJustification}
              maxLength={3000}
              onChange={(e) => {
                setJustification(e.target.value);
                setExtraDirty(true);
              }}
            />
          </Field>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {discard && (
          <div className="discard-prompt">
            <p>Hay cambios sin guardar. ¿Quieres descartarlos?</p>
            <button type="button" className="button secondary" onClick={() => setDiscard(false)}>
              Seguir editando
            </button>
            <button type="button" className="button danger" onClick={exit}>
              Descartar cambios
            </button>
          </div>
        )}
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={close}>
            Cancelar
          </button>
          <button type="submit" disabled={isSubmitting} className="button primary">
            Guardar hallazgo
          </button>
        </div>
      </form>
      <NavigationGuard leaving={leaving} dirty={(isDirty || extraDirty) && !isSubmitting} />
    </Modal>
  );
}
