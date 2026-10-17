import { test, expect } from '@playwright/test';

test('producción: rutas directas, recargas y recursos compilados sin errores', async ({
  page,
  request,
  baseURL,
}) => {
  test.skip(!process.env.SIGEE_BASE_URL, 'Requiere el build servido en SIGEE_BASE_URL.');
  const errors: string[] = [];
  const resources = new Set<string>();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', (resource) => {
    errors.push(`${resource.url()}: ${resource.failure()?.errorText}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`);
    if (/\.(?:js|css|woff2?|svg)(?:\?|$)/.test(response.url())) {
      resources.add(response.url());
    }
  });

  const routes = [
    ['/dashboard', 'Centro de control'],
    ['/activos', 'Activos eléctricos'],
    ['/activos/asset-1', 'Tablero de distribución principal'],
    ['/hallazgos', 'Hallazgos'],
    ['/epp', 'Inventario EPP'],
    ['/estudios-documentos', 'Estudios y documentos'],
    ['/alertas', 'Alertas'],
  ] as const;

  for (const [route, heading] of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.reload();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
  }

  await page.goto('/hallazgos?registro=finding-1');
  await expect(page.getByRole('dialog')).toContainText('HAL-001');
  await page.reload();
  await expect(page.getByRole('dialog')).toContainText('HAL-001');
  await page.evaluate(() => document.fonts.ready);

  const root = await request.get('/');
  const html = await root.text();
  expect(html).not.toContain('/src/main.tsx');
  expect(html).not.toContain('/@vite/client');
  expect(html).toMatch(/src="\/assets\/[^"\s]+\.js"/);

  const favicon = new URL('/favicon.svg', baseURL).href;
  resources.add(favicon);
  expect([...resources].some((url) => /\/assets\/.*\.woff2?$/.test(url))).toBe(true);
  expect([...resources].some((url) => /\/assets\/.*\.css$/.test(url))).toBe(true);
  expect([...resources].filter((url) => /\/assets\/.*\.js$/.test(url)).length).toBeGreaterThan(6);

  for (const url of resources) {
    expect(new URL(url).origin).toBe(new URL(baseURL!).origin);
    const response = await request.get(url);
    expect(response.status(), url).toBe(200);
    const mime = response.headers()['content-type'] ?? '';
    expect(mime, url).not.toContain('text/html');
    if (url.endsWith('.js')) expect(mime, url).toMatch(/javascript/);
    if (url.endsWith('.css')) expect(mime, url).toContain('text/css');
    if (url.endsWith('.svg')) expect(mime, url).toContain('image/svg+xml');
    expect((await response.body()).byteLength, url).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});
