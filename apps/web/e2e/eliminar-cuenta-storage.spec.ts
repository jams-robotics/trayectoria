import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import { E2E_PASSWORD, signUp, type TestUser } from './helpers/supabase';
import { makeTextZip } from './helpers/zip';

// #178: deleting the account empties `urdf/{uid}/` before `delete_account()` runs. The learner
// uploads one arm through the browser and then deletes the account; a second client of the same
// learner, signed in before the deletion, is what reads the bucket back — `list` under the
// prefix has to come back empty, which is only true if the client removed the object.

const PLANAR_URDF = readFileSync(
  path.resolve(import.meta.dirname, '../../../catalog/arms/planar2dof/planar2dof.urdf'),
  'utf8',
);

/** Name of the robot the planar URDF produces: `<robot name>` of the file. */
const PLANAR_NAME = 'Brazo plano 2 GDL';

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

/** Uploads the planar arm on `/cuenta/robots` and returns its object key. */
async function uploadArm(page: Page, user: TestUser): Promise<string> {
  await openHydrated(page, '/cuenta/robots');
  await page
    .getByLabel(auth.robots.uploadField, { exact: true })
    .setInputFiles({
      name: 'planar2dof.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from(makeTextZip({ 'planar2dof.urdf': PLANAR_URDF })),
    });
  await page.getByRole('button', { name: auth.robots.uploadSubmit, exact: true }).click();
  await expect(page.getByTestId('robot-row').getByTestId('robot-name')).toHaveText(PLANAR_NAME);

  const { data: rows } = await user.client
    .from('robots')
    .select('id')
    .eq('owner_id', user.userId);
  expect(rows).toHaveLength(1);
  return `${user.userId}/${rows?.[0]?.id}.zip`;
}

/** Types `ELIMINAR` and confirms, landing on the home page with the notice. */
async function deleteAccountOnPage(page: Page): Promise<void> {
  await openHydrated(page, '/cuenta');
  await page.getByTestId('delete-account-start').click();
  await page.getByLabel(auth.deleteAccount.confirmLabel, { exact: true }).fill('ELIMINAR');
  await page.getByTestId('delete-account-submit').click();
  await page.waitForURL('**/?cuenta=eliminada');
  await expect(page.getByTestId('account-deleted')).toContainText(auth.deleteAccount.done);
}

test('deleting the account empties the urdf bucket of the learner', async ({ page }) => {
  const email = uniqueEmail('eliminar-storage');
  const user = await signUp('student', 'Estudiante con brazo', email);
  await signInOnPage(page, email);

  const objectPath = await uploadArm(page, user);

  // Before the deletion the object is there, read back with the learner's own client.
  const stored = await user.client.storage.from('urdf').download(objectPath);
  expect(stored.error).toBeNull();

  await deleteAccountOnPage(page);

  // The prefix is empty: the client removed the object before `delete_account()` ran.
  const { data: objects } = await user.client.storage.from('urdf').list(user.userId);
  expect(objects ?? []).toHaveLength(0);
  const gone = await user.client.storage.from('urdf').download(objectPath);
  expect(gone.error).not.toBeNull();
});
