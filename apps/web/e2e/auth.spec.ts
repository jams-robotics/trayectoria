import { expect, test, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };

// F0-08 acceptance criteria. Runs against the local Supabase stack, where email confirmations
// are disabled (supabase/config.toml): sign-up returns a session directly. Date.now() is only
// used to make the email unique per run.
const PASSWORD = 'trayectoria-e2e-2026';
const DISPLAY_NAME = 'Docente E2E';

function uniqueEmail(): string {
  return `test+${Date.now()}@example.com`;
}

// Astro removes the `ssr` attribute of an island once React has hydrated it; typing before that
// would be undone by hydration (controlled inputs start empty).
async function openHydrated(page: Page, pathname: string): Promise<void> {
  await page.goto(pathname);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
}

async function signUpAsTeacher(page: Page, email: string): Promise<void> {
  await openHydrated(page, '/auth/registro');
  await page.getByLabel(auth.fields.displayName, { exact: true }).fill(DISPLAY_NAME);
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByLabel(auth.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByLabel(auth.roles.teacher, { exact: true }).check();
  await page.getByRole('button', { name: auth.register.submit }).click();
  await page.waitForURL('**/cuenta');
}

async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: auth.account.signOut }).click();
  await expect(page.getByTestId('auth-gate')).toHaveAttribute('data-auth', 'anonymous');
}

test('sign-up with the teacher role, then login, show the role on /cuenta', async ({ page }) => {
  const email = uniqueEmail();
  await signUpAsTeacher(page, email);

  await expect(page.getByTestId('auth-gate')).toHaveAttribute('data-auth', 'authenticated');
  await expect(page.getByTestId('account-role')).toHaveText(auth.roles.teacher);
  await expect(page.getByTestId('account-email')).toHaveText(email);
  await expect(page.getByTestId('account-display-name')).toHaveText(DISPLAY_NAME);

  await signOut(page);

  await openHydrated(page, '/auth/login');
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByLabel(auth.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: auth.login.submit, exact: true }).click();
  await page.waitForURL('**/cuenta');
  await expect(page.getByTestId('account-role')).toHaveText(auth.roles.teacher);
});

test('logout empties the session and /cuenta shows the sign-up CTA', async ({ page }) => {
  await signUpAsTeacher(page, uniqueEmail());
  await expect(page.getByTestId('auth-gate')).toHaveAttribute('data-auth', 'authenticated');

  await signOut(page);

  await expect(page.getByRole('link', { name: auth.gate.register })).toBeVisible();
  await expect(page.getByTestId('account-role')).toHaveCount(0);
  // supabase-js persists the session under an `sb-*` key; signOut removes it, so nothing
  // survives a reload either.
  const persistedSessionKeys = await page.evaluate(() =>
    Object.keys(window.localStorage).filter((key) => key.startsWith('sb-')),
  );
  expect(persistedSessionKeys).toEqual([]);

  await page.reload();
  await expect(page.getByTestId('auth-gate')).toHaveAttribute('data-auth', 'anonymous');
  await expect(page.getByRole('link', { name: auth.gate.register })).toBeVisible();
});
