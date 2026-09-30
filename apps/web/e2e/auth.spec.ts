import { expect, test, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };

import { emailLinkQuery } from './helpers/mail';

// F0-08 acceptance criteria. Runs against the local Supabase stack, where email confirmations
// are disabled (supabase/config.toml): sign-up returns a session directly. Date.now() plus the
// worker index make the email unique per run and per parallel worker.
const PASSWORD = 'trayectoria-e2e-2026';
const DISPLAY_NAME = 'Docente E2E';

function uniqueEmail(): string {
  return `test+${Date.now()}-${test.info().workerIndex}@example.com`;
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

// #520: an address that already has an account gets the same answer as a new sign-up waiting for
// its confirmation, so the form never tells whether the address is registered.
test('sign-up with a taken email answers like a new one and does not sign in', async ({ page }) => {
  const email = uniqueEmail();
  await signUpAsTeacher(page, email);
  await signOut(page);

  await openHydrated(page, '/auth/registro');
  await page.getByLabel(auth.fields.displayName, { exact: true }).fill('Otra persona');
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByLabel(auth.fields.password, { exact: true }).fill(`${PASSWORD}-otra`);
  await page.getByRole('button', { name: auth.register.submit }).click();
  await expect(page.getByText(auth.register.confirmEmail, { exact: true })).toBeVisible();
  await expect(page.getByText(auth.errors.signUpFailed)).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe('/auth/registro');
});

// #523: the name is required on the form, so the database never has to fall back to one.
test('sign-up without a name shows its own message and creates nothing', async ({ page }) => {
  await openHydrated(page, '/auth/registro');
  await page.getByLabel(auth.fields.displayName, { exact: true }).fill('   ');
  await page.getByLabel(auth.fields.email, { exact: true }).fill(uniqueEmail());
  await page.getByLabel(auth.fields.password, { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: auth.register.submit }).click();
  await expect(page.getByText(auth.validation.displayNameRequired, { exact: true })).toBeVisible();
  await expect(page.getByLabel(auth.fields.displayName, { exact: true })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(new URL(page.url()).pathname).toBe('/auth/registro');
});

// #518: with the PKCE flow the emails link to the site with a one-time `token_hash`, never with
// tokens in the URL, and the link works in a browser that did not ask for it (no code verifier).
test('the magic link signs in with its token_hash, also in another browser', async ({
  page,
  browser,
}) => {
  const email = uniqueEmail();
  await signUpAsTeacher(page, email);
  await signOut(page);
  await openHydrated(page, '/auth/login');
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByRole('button', { name: auth.login.magicLink }).click();
  await expect(page.getByText(auth.login.magicLinkSent)).toBeVisible();
  const query = await emailLinkQuery(page.request, email);
  expect(query).toContain('type=email');

  const other = await browser.newPage();
  await openHydrated(other, `/cuenta${query}`);
  await expect(other.getByTestId('account-email')).toHaveText(email);
  expect(other.url()).not.toContain('token_hash');
  await other.close();
});

test('the recovery link opens the new password form with a session', async ({ page }) => {
  const email = uniqueEmail();
  await signUpAsTeacher(page, email);
  await signOut(page);
  await openHydrated(page, '/auth/recuperar');
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByRole('button', { name: auth.recover.submit }).click();
  const query = await emailLinkQuery(page.request, email);
  expect(query).toContain('type=recovery');

  await openHydrated(page, `/auth/recuperar${query}`);
  await expect(page.getByLabel(auth.fields.newPassword, { exact: true })).toBeVisible();
  await expect(page).not.toHaveURL(/token_hash/);
  await openHydrated(page, '/cuenta');
  await expect(page.getByTestId('account-email')).toHaveText(email);
});
