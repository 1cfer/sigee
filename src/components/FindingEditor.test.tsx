import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { FindingEditor } from './FindingEditor';
import { ToastProvider } from './ui';
import { useDatabase } from '../store/useDatabase';

beforeEach(async () => {
  await useDatabase.getState().initialize();
  await useDatabase.getState().reset();
});
const renderWithRouter = (element: ReactNode) =>
  render(<RouterProvider router={createMemoryRouter([{ path: '/', element }])} />);
it('muestra validación accesible y guarda un hallazgo ligado a un activo', async () => {
  const user = userEvent.setup();
  const close = vi.fn();
  const before = useDatabase.getState().db.findings.length;
  renderWithRouter(
    <ToastProvider>
      <FindingEditor assetId="asset-1" onClose={close} />
    </ToastProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Guardar hallazgo' }));
  expect(await screen.findAllByRole('alert')).toHaveLength(2);
  expect(close).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText('Título *'), 'Observación de prueba');
  await user.type(screen.getByLabelText('Responsable *'), 'Persona demo');
  await user.click(screen.getByRole('button', { name: 'Guardar hallazgo' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(useDatabase.getState().db.findings).toHaveLength(before + 1);
  expect(useDatabase.getState().db.findings.at(-1)?.assetId).toBe('asset-1');
});
it('protege cambios sin guardar al cancelar', async () => {
  const user = userEvent.setup();
  const close = vi.fn();
  renderWithRouter(
    <ToastProvider>
      <FindingEditor onClose={close} />
    </ToastProvider>,
  );
  await user.type(screen.getByLabelText('Título *'), 'Borrador');
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(close).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
  expect(screen.getByLabelText('Título *')).toHaveValue('Borrador');
});
