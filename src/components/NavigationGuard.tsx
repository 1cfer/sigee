import { useCallback, type RefObject } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { Modal } from './ui';

export function NavigationGuard({
  dirty,
  leaving,
}: {
  dirty: boolean;
  leaving: RefObject<boolean>;
}) {
  const blocker = useBlocker(() => dirty && !leaving.current);
  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (dirty) {
          event.preventDefault();
          event.returnValue = '';
        }
      },
      [dirty],
    ),
  );
  return (
    <Modal
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      title="Hay cambios sin guardar"
      description="Si sales de esta vista perderás el borrador. Puedes volver para guardarlo."
    >
      <div className="dialog-actions">
        <button className="button secondary" onClick={() => blocker.reset?.()}>
          Seguir editando
        </button>
        <button className="button primary" onClick={() => blocker.proceed?.()}>
          Salir y descartar
        </button>
      </div>
    </Modal>
  );
}
