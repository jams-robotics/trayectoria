import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import urdf from '../../../packages/i18n/locales/es/urdf.json' with { type: 'json' };
import { E2E_PASSWORD, signUp, type TestUser } from './helpers/supabase';
import { makeTextZip, makeZip } from './helpers/zip';

// F3-04 acceptance criteria, against the local Supabase stack. The zips are written in memory by
// e2e/helpers/zip.ts (decision 8), so no binary fixture lives in the repository. The valid case
// is the planar 2-DOF arm of the catalogue: primitive geometry, no meshes, so nothing else has to
// travel inside the archive.

const PLANAR_URDF = readFileSync(
  path.resolve(import.meta.dirname, '../../../catalog/arms/planar2dof/planar2dof.urdf'),
  'utf8',
);

/** Name of the robot the planar URDF produces: `<robot name>` of the file. */
const PLANAR_NAME = 'Brazo plano 2 GDL';

/** One byte over the 20 MB the ticket allows. */
const OVERSIZED_BYTES = 20_971_521;

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${test.info().workerIndex}@example.com`;
}

async function openHydrated(page: Page, pathname: string): Promise<void> {
  await page.goto(pathname);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
}

/** Signs in through the UI, which is what puts the session in the browser's storage. */
async function signInOnPage(page: Page, email: string): Promise<void> {
  await openHydrated(page, '/auth/login');
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByLabel(auth.fields.password, { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: auth.login.submit, exact: true }).click();
  await page.waitForURL('**/cuenta');
}

/** Creates a learner and opens `/cuenta/robots` with their session. */
async function signedInOnRobots(page: Page, prefix: string): Promise<TestUser> {
  const email = uniqueEmail(prefix);
  const user = await signUp('student', 'Estudiante E2E', email);
  await signInOnPage(page, email);
  await openHydrated(page, '/cuenta/robots');
  return user;
}

/** Hands the file chooser a zip built in memory. */
async function chooseZip(page: Page, name: string, bytes: Uint8Array): Promise<void> {
  await page
    .getByLabel(auth.robots.uploadField, { exact: true })
    .setInputFiles({ name, mimeType: 'application/zip', buffer: Buffer.from(bytes) });
}

async function submitUpload(page: Page): Promise<void> {
  await page.getByRole('button', { name: auth.robots.uploadSubmit, exact: true }).click();
}

test('uploading a valid zip creates the robot, its object, and deleting it removes both', async ({
  page,
}) => {
  const user = await signedInOnRobots(page, 'robots-ok');
  await expect(page.getByTestId('robots-empty')).toBeVisible();

  await chooseZip(page, 'planar2dof.zip', makeTextZip({ 'planar2dof.urdf': PLANAR_URDF }));
  await submitUpload(page);

  // The robot shows up in the list as an `arm-serial` named after the URDF.
  const row = page.getByTestId('robot-row');
  await expect(row).toHaveCount(1);
  await expect(row.getByTestId('robot-name')).toHaveText(PLANAR_NAME);
  await expect(row).toHaveAttribute('data-kind', 'arm-serial');

  // The row and the object are both there, read back with the learner's own client.
  const { data: rows } = await user.client
    .from('robots')
    .select('id, kind, urdf_path')
    .eq('owner_id', user.userId);
  expect(rows).toHaveLength(1);
  const robot = rows?.[0];
  expect(robot?.kind).toBe('arm-serial');
  expect(robot?.urdf_path).toBe(`urdf/${user.userId}/${robot?.id}.zip`);

  const objectPath = `${user.userId}/${robot?.id}.zip`;
  const stored = await user.client.storage.from('urdf').download(objectPath);
  expect(stored.error).toBeNull();
  expect(stored.data).not.toBeNull();

  // Deleting takes the row and the object with it, after the inline confirmation.
  await page.getByTestId('delete-robot').click();
  await page.getByRole('button', { name: auth.robots.delete, exact: true }).click();
  await expect(page.getByTestId('robots-empty')).toBeVisible();

  const { data: afterRows } = await user.client
    .from('robots')
    .select('id')
    .eq('owner_id', user.userId);
  expect(afterRows).toEqual([]);
  const gone = await user.client.storage.from('urdf').download(objectPath);
  expect(gone.error).not.toBeNull();
});

test('a zip with a `..` entry is refused and writes nothing', async ({ page }) => {
  const user = await signedInOnRobots(page, 'robots-traversal');

  await chooseZip(
    page,
    'traversal.zip',
    makeTextZip({ 'robot.urdf': PLANAR_URDF, '../evil.stl': 'solid evil' }),
  );
  await submitUpload(page);

  await expect(page.getByTestId('upload-error')).toHaveText(urdf.pathTraversal);
  await expect(page.getByTestId('robots-empty')).toBeVisible();

  const { data: rows } = await user.client.from('robots').select('id').eq('owner_id', user.userId);
  expect(rows).toEqual([]);
  const { data: objects } = await user.client.storage.from('urdf').list(user.userId);
  expect(objects ?? []).toHaveLength(0);
});

test('a zip of 21 MB is refused before it is read', async ({ page }) => {
  const user = await signedInOnRobots(page, 'robots-large');

  // A stored zip whose single entry pads the archive past the limit: the size rule fires first.
  const filler = new Uint8Array(OVERSIZED_BYTES);
  await chooseZip(page, 'huge.zip', makeZip([{ path: 'robot.urdf', bytes: filler }]));
  await submitUpload(page);

  await expect(page.getByTestId('upload-error')).toHaveText(urdf.tooLarge);
  await expect(page.getByTestId('robots-empty')).toBeVisible();

  const { data: rows } = await user.client.from('robots').select('id').eq('owner_id', user.userId);
  expect(rows).toEqual([]);
});

test('a xacro file and a second URDF are refused with their own message', async ({ page }) => {
  await signedInOnRobots(page, 'robots-invalid');

  await chooseZip(page, 'xacro.zip', makeTextZip({ 'robot.xacro': '<robot/>' }));
  await submitUpload(page);
  await expect(page.getByTestId('upload-error')).toHaveText(urdf.xacroUnsupported);

  await chooseZip(
    page,
    'two.zip',
    makeTextZip({ 'a.urdf': PLANAR_URDF, 'b.urdf': PLANAR_URDF }),
  );
  await submitUpload(page);
  await expect(page.getByTestId('upload-error')).toHaveText(urdf.multipleUrdf);

  await expect(page.getByTestId('robots-empty')).toBeVisible();
});

test('storage RLS: a second learner cannot read the first one’s object', async ({ page }) => {
  const owner = await signedInOnRobots(page, 'robots-rls');
  await chooseZip(page, 'planar2dof.zip', makeTextZip({ 'planar2dof.urdf': PLANAR_URDF }));
  await submitUpload(page);
  await expect(page.getByTestId('robot-row')).toHaveCount(1);

  const { data: rows } = await owner.client.from('robots').select('id').eq('owner_id', owner.userId);
  const objectPath = `${owner.userId}/${rows?.[0]?.id}.zip`;

  // The owner reads it; a second signed-in learner does not (policies of migration 0003).
  expect((await owner.client.storage.from('urdf').download(objectPath)).error).toBeNull();
  const intruder = await signUp('student', 'Intruso E2E', uniqueEmail('robots-intruder'));
  const stolen = await intruder.client.storage.from('urdf').download(objectPath);
  expect(stolen.error).not.toBeNull();
  expect(stolen.data).toBeNull();

  // Nor can they see the row: the `robots` policies scope it to its owner.
  const { data: seen } = await intruder.client.from('robots').select('id');
  expect(seen).toEqual([]);
});

test('renaming a robot keeps the new name after a reload', async ({ page }) => {
  await signedInOnRobots(page, 'robots-rename');
  await chooseZip(page, 'planar2dof.zip', makeTextZip({ 'planar2dof.urdf': PLANAR_URDF }));
  await submitUpload(page);
  await expect(page.getByTestId('robot-name')).toHaveText(PLANAR_NAME);

  await page.getByTestId('rename-robot').click();
  await page.getByLabel(auth.robots.renameLabel, { exact: true }).fill('Mi brazo plano');
  await page.getByRole('button', { name: auth.robots.renameSave, exact: true }).click();
  await expect(page.getByTestId('robot-name')).toHaveText('Mi brazo plano');

  await openHydrated(page, '/cuenta/robots');
  await expect(page.getByTestId('robot-name')).toHaveText('Mi brazo plano');
});
