import * as Dialog from '@radix-ui/react-dialog';
import { Check, Search, X, ArrowUpRight, Inbox } from 'lucide-react';
import { cloneElement, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ToastContext } from './toast-context';

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'teal' | 'amber' | 'red';
}) {
  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" />
      {children}
    </span>
  );
}
export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      tone={
        status === 'cerrado' || status === 'registrado' || status === 'registrada'
          ? 'teal'
          : status === 'en progreso' || status.includes('pendiente') || status === 'en revisión'
            ? 'amber'
            : 'neutral'
      }
    >
      {status}
    </Badge>
  );
}
export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge tone={priority === 'alta' ? 'red' : priority === 'media' ? 'amber' : 'neutral'}>
      {priority}
    </Badge>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      <div className="heading-actions">{actions}</div>
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      className="filter-select"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
export function EmptyState({
  title = 'No encontramos registros',
  description = 'Prueba con otra búsqueda o ajusta los filtros.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Inbox size={26} strokeWidth={1.5} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const content = useRef<HTMLDivElement>(null);
  const [discard, setDiscard] = useState(false);
  const close = () => {
    if (content.current?.querySelector('form[data-unsaved="true"]')) setDiscard(true);
    else onClose();
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          ref={content}
          className={`dialog-content ${wide ? 'dialog-wide' : ''}`}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="dialog-header">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close className="icon-button" aria-label="Cerrar diálogo">
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
          {discard && (
            <div className="discard-prompt">
              <p>Hay información sin guardar en este formulario.</p>
              <button className="button secondary" onClick={() => setDiscard(false)}>
                Seguir editando
              </button>
              <button
                className="button danger"
                onClick={() => {
                  setDiscard(false);
                  onClose();
                }}
              >
                Descartar y cerrar
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  description,
  label = 'Confirmar',
  danger = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  label?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <div className="dialog-actions">
        <button className="button secondary" onClick={onClose}>
          Cancelar
        </button>
        <button
          className={`button ${danger ? 'danger' : 'primary'}`}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {label}
        </button>
      </div>
    </Modal>
  );
}
export function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  const control = cloneElement(
    children as ReactElement<{
      id: string;
      'aria-invalid'?: boolean;
      'aria-describedby'?: string;
      'aria-required'?: boolean;
    }>,
    {
      id,
      'aria-invalid': Boolean(error),
      'aria-describedby': error ? `${id}-error` : undefined,
      'aria-required': required,
    },
  );
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span className="required"> *</span>}
      </label>
      {control}
      {error && (
        <small id={`${id}-error`} className="field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
export function InlineLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowUpRight size={14} />
    </Link>
  );
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  return (
    <ToastContext.Provider value={setMessage}>
      {children}
      {message && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label="Cerrar confirmación"
            onClick={() => setMessage('')}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
