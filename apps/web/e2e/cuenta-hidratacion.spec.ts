import { expect, test, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import { E2E_PASSWORD, signUp } from './helpers/supabase';

// #236: the islands of /cuenta and /cuenta/robots depend on `$sessionReady`, which the server
// does not know. When another island had already read the session, an island hydrated later
// painted its session view over the server's "loading" markup and React threw error #418.
// Holding back one island's module forces that order, which otherwise depends on the load.

/** Margin for the session to be read before the held-back module arrives. */
const MODULE_DELAY_MS = 500;

function uniqueEmail(): string {
  return `hidratacion+${Date.now()}-${test.info().workerIndex}@example.com`;
}

function collectPageErrors(page: Page): Error[] {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  return pageErrors;
}

/** Delays the module of one island; `pattern` matches its dev (.tsx) and built (.js) URL. */
async function holdBackModule(page: Page, pattern: RegExp): Promise<void> {
  await page.route(pattern, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, MODULE_DELAY_MS));
    await route.continue();
  });
}

/** Signs in through the UI, which is what puts the session in the browser's storage. */
async function signInOnPage(page: Page): Promise<void> {
  const email = uniqueEmail();
  await signUp('student', 'Estudiante E2E', email);
  await page.goto('/auth/login');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByLabel(auth.fields.password, { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: auth.login.submit, exact: true }).click();
  await page.waitForURL('**/cuenta');
}

test('/cuenta without a session hydrates with no errors although the session is read first', async ({
  page,
}) => {
  const pageErrors = collectPageErrors(page);
  await holdBackModule(page, /\/Account\./);

  await page.goto('/cuenta');
  await expect(page.getByTestId('auth-gate')).toHaveAttribute('data-auth', 'anonymous');
  await expect(page.getByRole('link', { name: auth.gate.register })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('/cuenta with a session hydrates the account with no errors although the session is read first', async ({
  page,
}) => {
  await signInOnPage(page);
  const pageErrors = collectPageErrors(page);
  await holdBackModule(page, /\/Account\./);

  await page.goto('/cuenta');
  await expect(page.getByTestId('auth-gate')).toHaveAttribute('data-auth', 'authenticated');
  await expect(page.getByTestId('account-email')).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('/cuenta with a session hydrates «Mi robot» with no errors although the session is read first', async ({
  page,
}) => {
  await signInOnPage(page);
  const pageErrors = collectPageErrors(page);
  await holdBackModule(page, /\/MyRobotIsland\./);

  await page.goto('/cuenta');
  await expect(page.getByTestId('my-robot-form')).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('/cuenta/robots without a session hydrates with no errors although its module arrives late', async ({
  page,
}) => {
  const pageErrors = collectPageErrors(page);
  await holdBackModule(page, /\/RobotsIsland\./);

  await page.goto('/cuenta/robots');
  await expect(page.getByTestId('auth-gate')).toHaveAttribute('data-auth', 'anonymous');
  await expect(page.getByRole('link', { name: auth.gate.register })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
