import { expect, test, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import { typeEmailedCode } from './helpers/mail';
import { E2E_PASSWORD, anonClient, signUp } from './helpers/supabase';

// #521: deleting the account and changing the password need the six-digit code GoTrue emails to
// the account (`reauthenticate()`); holding the session is not enough. The local stack delivers
// the emails to Mailpit (e2e/helpers/mail.ts). Each test uses its own account.

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${test.info().workerIndex}@example.com`;
}

async function openHydrated(page: Page, pathname: string): Promise<void> {
  await page.goto(pathname);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
}

async function signInOnPage(page: Page, email: string): Promise<void> {
  await openHydrated(page, '/auth/login');
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByLabel(auth.fields.password, { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: auth.login.submit, exact: true }).click();
  await page.waitForURL('**/cuenta');
}

async function canSignIn(email: string, password: string): Promise<boolean> {
  const { error } = await anonClient().auth.signInWithPassword({ email, password });
  return error === null;
}

test('a wrong code deletes nothing and burns the code; a new one deletes the account', async ({
  page,
}) => {
  const email = uniqueEmail('reauth-delete');
  await signUp('student', 'Estudiante con código', email);
  await signInOnPage(page, email);

  await openHydrated(page, '/cuenta');
  await page.getByTestId('delete-account-start').click();
  const code = await typeEmailedCode(page, email, auth.reauth.codeLabel);
  const wrong = code === '000000' ? '111111' : '000000';
  await page.getByLabel(auth.reauth.codeLabel, { exact: true }).fill(wrong);
  await page.getByLabel(auth.deleteAccount.confirmLabel, { exact: true }).fill('ELIMINAR');
  await page.getByTestId('delete-account-submit').click();

  const section = page.getByTestId('delete-account');
  await expect(section.getByRole('alert')).toHaveText(auth.reauth.invalid);
  await expect(page.getByTestId('delete-account-submit')).toBeDisabled();
  expect(await canSignIn(email, E2E_PASSWORD)).toBe(true);

  // The wrong attempt burnt the pending code, so the learner asks for a new one, past the
  // one-second spacing GoTrue keeps between two codes of the same account (`max_frequency`).
  await page.waitForTimeout(1_100);
  await typeEmailedCode(page, email, auth.reauth.codeLabel, code);
  await page.getByTestId('delete-account-submit').click();
  await page.waitForURL('**/?cuenta=eliminada');
  expect(await canSignIn(email, E2E_PASSWORD)).toBe(false);
});

test('the new password form asks for the emailed code even with a session open', async ({
  page,
}) => {
  const email = uniqueEmail('reauth-password');
  await signUp('student', 'Estudiante con clave nueva', email);
  await signInOnPage(page, email);
  const newPassword = `${E2E_PASSWORD}-nueva`;

  // A session and the `type=recovery` of the recovery link (#518) reach the form, but no code:
  // the password stays.
  await openHydrated(page, '/auth/recuperar?type=recovery');
  await page.getByLabel(auth.fields.newPassword, { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: auth.recover.update, exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(auth.reauth.needed);
  expect(await canSignIn(email, newPassword)).toBe(false);

  await typeEmailedCode(page, email, auth.reauth.codeLabel);
  await page.getByRole('button', { name: auth.recover.update, exact: true }).click();
  await expect(page.getByText(auth.recover.updated, { exact: true })).toBeVisible();
  expect(await canSignIn(email, newPassword)).toBe(true);
});
