import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import sims from '../../../packages/i18n/locales/es/sims.json' with { type: 'json' };
import urdf from '../../../packages/i18n/locales/es/urdf.json' with { type: 'json' };
import { E2E_PASSWORD, signUp, type TestUser } from './helpers/supabase';
import { makeZip, makeTextZip, type ZipFile } from './helpers/zip';

// F5-04 (#137): «Importar…» y «Mis robots» en `/simuladores/brazo`, contra el stack local de
// Supabase. El zip del SO-101 se arma en memoria con el escritor store-only de F3-04 a partir de
// `catalog/arms/so101/` (decisión 6), así que no hay ningún binario de 16 MB en el repositorio.

/** Margen para la isla perezosa: su chunk arrastra three y urdf-loader. */
const ISLAND_TIMEOUT_MS = 30_000;

const CATALOG = path.resolve(import.meta.dirname, '../../../catalog/arms');

const PLANAR_URDF = readFileSync(path.join(CATALOG, 'planar2dof/planar2dof.urdf'), 'utf8');

/** El zip del SO-101: su URDF y todas sus mallas, con las mismas rutas relativas del catálogo. */
function so101Zip(): Uint8Array {
  const root = path.join(CATALOG, 'so101');
  const files: ZipFile[] = [
    { path: 'so101.urdf', bytes: new Uint8Array(readFileSync(path.join(root, 'so101.urdf'))) },
  ];
  for (const name of readdirSync(path.join(root, 'meshes'))) {
    files.push({
      path: `meshes/${name}`,
      bytes: new Uint8Array(readFileSync(path.join(root, 'meshes', name))),
    });
  }
  return makeZip(files);
}

/** Cuántas articulaciones actuadas declara un URDF (misma cuenta que `sim-brazo.spec.ts`). */
function actuatedJointCount(urdfPath: string): number {
  const source = readFileSync(urdfPath, 'utf8');
  return source.match(/<joint\b[^>]*\btype="(?:revolute|continuous|prismatic)"/g)?.length ?? 0;
}

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${test.info().workerIndex}@example.com`;
}

async function openHydrated(page: Page, pathname: string): Promise<void> {
  await page.goto(pathname);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
}

/** Crea una cuenta y deja su sesión en el navegador, que es lo que la isla lee. */
async function signedIn(page: Page, prefix: string): Promise<TestUser> {
  const email = uniqueEmail(prefix);
  const user = await signUp('student', 'Estudiante E2E', email);
  await openHydrated(page, '/auth/login');
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByLabel(auth.fields.password, { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: auth.login.submit, exact: true }).click();
  await page.waitForURL('**/cuenta');
  return user;
}

/** Abre el simulador de brazo y espera a que el visor tenga una pose resuelta. */
async function openSimulator(page: Page): Promise<void> {
  await page.goto('/simuladores/brazo?robot=planar2dof');
  await expect(page.locator('[data-testid="arm-viewer"]')).toBeVisible({
    timeout: ISLAND_TIMEOUT_MS,
  });
  await expect(page.locator('[data-testid="sims.arm.x"]')).not.toBeEmpty({
    timeout: ISLAND_TIMEOUT_MS,
  });
}

/** Abre el diálogo de importación desde el selector. */
async function openImport(page: Page): Promise<void> {
  await page.locator('[data-testid="arm-source-select"]').selectOption('import');
  await expect(page.getByTestId('import-urdf-dialog')).toBeVisible();
}

/** Entrega el zip al selector de archivo del diálogo y lo envía. */
async function submitZip(page: Page, name: string, bytes: Uint8Array): Promise<void> {
  await page
    .getByLabel(auth.robots.uploadField, { exact: true })
    .setInputFiles({ name, mimeType: 'application/zip', buffer: Buffer.from(bytes) });
  await page.getByRole('button', { name: auth.robots.uploadSubmit, exact: true }).click();
}

test.describe('/simuladores/brazo · importar (F5-04)', () => {
  test('con sesión, importar el SO-101 lo muestra y lo guarda en «Mis robots»', async ({
    page,
  }) => {
    const user = await signedIn(page, 'import-ok');
    await openSimulator(page);

    await openImport(page);
    await submitZip(page, 'so101.zip', so101Zip());

    // El brazo importado se dibuja con un slider por articulación actuada del URDF subido.
    await expect(page.getByTestId('import-notice')).toHaveText(sims.import.saved, {
      timeout: ISLAND_TIMEOUT_MS,
    });
    const sliders = page.locator('[data-testid="joint-sliders"] input[type="range"]');
    await expect(sliders).toHaveCount(actuatedJointCount(path.join(CATALOG, 'so101/so101.urdf')), {
      timeout: ISLAND_TIMEOUT_MS,
    });

    // La fila y su objeto están en Supabase, leídos con el cliente del propio estudiante.
    const { data: rows } = await user.client
      .from('robots')
      .select('id, kind, urdf_path')
      .eq('owner_id', user.userId);
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.kind).toBe('arm-serial');
    expect(rows?.[0]?.urdf_path).toBe(`urdf/${user.userId}/${rows?.[0]?.id ?? ''}.zip`);

    // Al recargar, el brazo aparece en «Mis robots» y elegirlo lo vuelve a cargar del bucket.
    await openSimulator(page);
    const select = page.locator('[data-testid="arm-source-select"]');
    await expect(page.getByTestId('arm-saved-group')).toHaveCount(1, {
      timeout: ISLAND_TIMEOUT_MS,
    });
    await select.selectOption(`saved:${rows?.[0]?.id ?? ''}`);
    await expect(sliders).toHaveCount(actuatedJointCount(path.join(CATALOG, 'so101/so101.urdf')), {
      timeout: ISLAND_TIMEOUT_MS,
    });
  });

  test('un zip con traversal se rechaza y el visor no cambia', async ({ page }) => {
    const user = await signedIn(page, 'import-traversal');
    await openSimulator(page);

    // El brazo que hay antes de importar: el del catálogo, con sus dos articulaciones.
    const sliders = page.locator('[data-testid="joint-sliders"] input[type="range"]');
    await expect(sliders).toHaveCount(2);

    await openImport(page);
    await submitZip(
      page,
      'traversal.zip',
      makeTextZip({ 'robot.urdf': PLANAR_URDF, '../evil.stl': 'solid evil' }),
    );

    await expect(page.getByTestId('upload-error')).toHaveText(urdf.pathTraversal);
    // El diálogo sigue abierto, el visor no cambió y no se guardó nada.
    await expect(page.getByTestId('import-urdf-dialog')).toBeVisible();
    await expect(sliders).toHaveCount(2);
    const { data: rows } = await user.client.from('robots').select('id').eq('owner_id', user.userId);
    expect(rows).toEqual([]);
  });

  test('sin sesión el brazo se carga solo en memoria y no se guarda nada', async ({ page }) => {
    await openSimulator(page);

    await openImport(page);
    await expect(page.getByTestId('import-anonymous')).toBeVisible();
    await submitZip(page, 'planar2dof.zip', makeTextZip({ 'planar2dof.urdf': PLANAR_URDF }));

    await expect(page.getByTestId('import-notice')).toHaveText(sims.import.loaded, {
      timeout: ISLAND_TIMEOUT_MS,
    });
    // El selector se queda en el brazo importado y «Mis robots» no aparece sin sesión.
    await expect(page.locator('[data-testid="arm-source-select"]')).toHaveValue('imported');
    await expect(page.getByTestId('arm-saved-group')).toHaveCount(0);
  });
});
