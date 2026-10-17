import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('protege borradores al navegar y descarga el resumen de indicadores', async ({ page }) => {
  await page.goto('/estudios-documentos?tipo=documentos&registro=doc-1');
  await page.getByLabel('Título').fill('Borrador que debe conservarse');
  await page.getByRole('link', { name: 'ACT-001', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hay cambios sin guardar' })).toBeVisible();
  await page.getByRole('button', { name: 'Seguir editando', exact: true }).click();
  await expect(page.getByLabel('Título')).toHaveValue('Borrador que debe conservarse');
  await page.getByRole('link', { name: 'ACT-001', exact: true }).click();
  await page.getByRole('button', { name: 'Salir y descartar', exact: true }).click();
  await expect(page).toHaveURL(/activos\/asset-1/);
  await page.goto('/dashboard');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar resumen' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('sigee-indicadores.csv');
  expect(await download.failure()).toBeNull();
});

test('accesibilidad automatizada en los seis módulos y sus editores', async ({ page }) => {
  test.setTimeout(90000);
  for (const route of [
    '/dashboard',
    '/activos',
    '/hallazgos',
    '/epp',
    '/estudios-documentos',
    '/alertas',
    '/hallazgos?registro=finding-1',
    '/epp?registro=ppe-1',
    '/estudios-documentos?tipo=estudios&registro=study-1',
  ]) {
    await page.goto(route);
    await page.getByRole(route.includes('registro=') ? 'dialog' : 'main').waitFor();
    await page.evaluate(() => document.fonts.ready);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(result.violations, route).toEqual([]);
  }
});

test('caso estrella: activo → hallazgo → indicadores → alerta → cierre → persistencia → restauración', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page).toHaveURL(/dashboard/);
  const initialOpen = Number(
    await page
      .getByTestId('metric-open')
      .innerText()
      .then((v) => v.split('/')[0]),
  );
  const initialHigh = Number(await page.getByTestId('metric-high').innerText());
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /Activos eléctricos/ })
    .click();
  await page.getByRole('link', { name: 'Abrir ACT-001', exact: true }).click();
  await page.getByRole('button', { name: 'Crear hallazgo', exact: true }).click();
  await expect(page.getByLabel('Activo asociado')).toHaveValue('asset-1');
  await page
    .getByLabel('Título', { exact: false })
    .fill('Verificar referencia ficticia de demostración');
  await page
    .getByLabel('Descripción', { exact: true })
    .fill('Observación ficticia creada durante la demostración.');
  await page.getByLabel('Prioridad', { exact: false }).selectOption('alta');
  await page.getByLabel('Responsable', { exact: false }).fill('Responsable de demostración');
  await page.getByRole('button', { name: 'Guardar hallazgo' }).click();
  await expect(page.getByRole('status')).toContainText('Hallazgo creado');
  await expect(
    page.getByRole('link', { name: /^HAL-015 Verificar referencia ficticia de demostración/ }),
  ).toBeVisible();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /Centro de control/ })
    .click();
  await expect(page.getByTestId('metric-open')).toContainText(String(initialOpen + 1));
  await expect(page.getByTestId('metric-high')).toHaveText(
    String(initialHigh + 1).padStart(2, '0'),
  );
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /Alertas/ })
    .click();
  await page.getByRole('link', { name: /Verificar referencia ficticia de demostración/ }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Verificar referencia ficticia de demostración',
  );
  await page.getByRole('button', { name: 'Editar hallazgo' }).click();
  await page.getByLabel('Estado *', { exact: true }).selectOption('cerrado');
  await page.getByRole('button', { name: 'Guardar hallazgo' }).click();
  await expect(page.getByRole('dialog')).toContainText('cerrado');
  await page.getByLabel('Añadir comentario').fill('Seguimiento documental finalizado en la demo.');
  await page.getByRole('button', { name: 'Registrar comentario' }).click();
  await page.reload();
  await expect(page.getByRole('dialog')).toContainText('cerrado');
  await expect(page.getByRole('dialog')).toContainText(
    'Seguimiento documental finalizado en la demo.',
  );
  await page.getByRole('button', { name: 'Cerrar diálogo', exact: true }).click();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /Alertas/ })
    .click();
  await expect(
    page.getByRole('link', { name: /Verificar referencia ficticia de demostración/ }),
  ).toHaveCount(0);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /Centro de control/ })
    .click();
  await expect(page.getByTestId('metric-open')).toContainText(String(initialOpen));
  await expect(page.getByTestId('metric-high')).toHaveText(String(initialHigh).padStart(2, '0'));
  await page.getByRole('button', { name: 'Restaurar datos de demostración', exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Restaurar datos de demostración', exact: true }).click();
  await page.getByRole('button', { name: 'Restaurar datos', exact: true }).click();
  await page.reload();
  await page.goto('/hallazgos');
  await page
    .getByRole('textbox', { name: 'Buscar hallazgo, activo o responsable…' })
    .fill('Verificar referencia ficticia de demostración');
  await expect(page.getByText('No encontramos registros')).toBeVisible();
  expect(errors).toEqual([]);
});

test('EPP conserva el inventario y las revisiones documentales actualizan avisos', async ({
  page,
}) => {
  await page.goto('/epp?registro=ppe-1');
  await page.getByLabel('Cantidad total').fill('999');
  await page.getByRole('button', { name: 'Guardar inventario' }).click();
  await expect(page.getByRole('alert')).toContainText('El total debe coincidir');
  await page.getByLabel('Cantidad total').fill('8');
  await page.getByRole('button', { name: 'Guardar inventario' }).click();
  await page.getByLabel('Activo de destino').selectOption('asset-2');
  await page.getByLabel('Unidades *', { exact: true }).fill('2');
  await page.getByRole('button', { name: 'Asignar', exact: true }).click();
  await expect(page.getByLabel('Cantidad disponible')).toHaveValue('3');
  await page.reload();
  await expect(page.getByLabel('Cantidad disponible')).toHaveValue('3');
  await page.getByRole('button', { name: 'Devolver', exact: true }).last().click();
  await expect(page.getByLabel('Cantidad disponible')).toHaveValue('5');
  await page.goto('/estudios-documentos?tipo=estudios&registro=study-1');
  await page.getByLabel('Próxima revisión').fill('2099-12-31');
  await page.getByLabel('Estado documental').selectOption('registrado');
  await page.getByRole('button', { name: 'Guardar metadatos' }).click();
  await page.goto('/alertas');
  await expect(page.getByRole('link', { name: /Revisión pendiente · EST-001/ })).toHaveCount(0);
  await page.goto('/estudios-documentos?tipo=documentos&registro=doc-1');
  await page.getByLabel('Título').fill('Ficha documental actualizada');
  await page.getByRole('button', { name: 'Guardar metadatos' }).click();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Ficha documental actualizada', exact: true }),
  ).toBeVisible();
});

test('navegación, tablet, menú móvil y recuperación de datos dañados', async ({ page }) => {
  await page.goto('/dashboard');
  for (const [route, heading] of [
    ['/dashboard', 'Centro de control'],
    ['/activos', 'Activos eléctricos'],
    ['/hallazgos', 'Hallazgos'],
    ['/epp', 'Inventario EPP'],
    ['/estudios-documentos', 'Estudios y documentos'],
    ['/alertas', 'Alertas'],
  ]) {
    await page.goto(route!);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await page.goto('/dashboard');
  await page.screenshot({ path: 'test-results/dashboard-escritorio.png', fullPage: true });
  await page.setViewportSize({ width: 900, height: 1100 });
  await expect(page.getByTestId('metric-open')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/dashboard-tablet.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page
    .getByRole('navigation')
    .getByRole('link', { name: /Hallazgos/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Hallazgos', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.goto('/dashboard');
  await page.screenshot({ path: 'test-results/dashboard-movil.png', fullPage: true });
  await page.evaluate(() => localStorage.setItem('sigee-demo', '{roto'));
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Se recuperó la demostración');
  await expect(page.getByTestId('metric-open')).toContainText('11');
});
