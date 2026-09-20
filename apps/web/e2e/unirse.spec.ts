import { expect, test, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import aula from '../../../packages/i18n/locales/es/aula.json' with { type: 'json' };
import { E2E_PASSWORD, anonClient, signUp } from './helpers/supabase';

// F3-03 acceptance criteria. Runs against the local Supabase stack, where email confirmations
// are disabled (supabase/config.toml), so sign-up returns a session directly. The teacher and
// their group are created from Node with the anon key (e2e/helpers/supabase.ts); the student
// does everything through the browser, which is what the criteria are about.
const GROUP_NAME = 'Mecatrónica 2026-2 · B';

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${test.info().workerIndex}@example.com`;
}

/** Eight characters of the invite alphabet, unique per run: `invite_code` has a unique index. */
function uniqueInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    { length: 8 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)] ?? 'A',
  ).join('');
}

// Astro removes the `ssr` attribute of an island once React has hydrated it; typing before that
// would be undone by hydration (controlled inputs start empty).
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

/** A teacher with one group; returns its invite code. */
async function teacherWithGroup(): Promise<string> {
  const teacher = await signUp('teacher', 'Docente E2E', uniqueEmail('unirse-teacher'));
  const code = uniqueInviteCode();
  const { error } = await teacher.client
    .from('groups')
    .insert({ owner_id: teacher.userId, name: GROUP_NAME, invite_code: code });
  expect(error).toBeNull();
  return code;
}

test('a student joins with the code, sees the group in /cuenta and leaves it', async ({ page }) => {
  const code = await teacherWithGroup();
  const studentEmail = uniqueEmail('unirse-student');
  await signUp('student', 'Estudiante E2E', studentEmail);
  await signInOnPage(page, studentEmail);

  // An invalid code shows the single generic message and reveals nothing else.
  await openHydrated(page, '/unirse');
  await page.getByLabel(aula.join.code, { exact: true }).fill('ZZZZZZZZ');
  await page.getByRole('button', { name: aula.join.submit, exact: true }).click();
  await expect(page.getByTestId('join-error')).toHaveText(aula.join.invalid);
  await expect(page).toHaveURL(/\/unirse$/);

  // The valid code, typed with the spaces a student would copy, lands on /cuenta with the group.
  await page.getByLabel(aula.join.code, { exact: true }).fill(` ${code.slice(0, 4)} ${code.slice(4)} `);
  await page.getByRole('button', { name: aula.join.submit, exact: true }).click();
  await page.waitForURL('**/cuenta');
  await expect(page.getByTestId('my-group-row')).toHaveCount(1);
  await expect(page.getByTestId('my-group-list')).toContainText(GROUP_NAME);

  // "Salir" takes the group out of the list without a reload.
  await page.getByRole('button', { name: auth.groups.leave.replace('{{name}}', GROUP_NAME) }).click();
  await page.getByRole('button', { name: auth.groups.leaveYes, exact: true }).click();
  await expect(page.getByTestId('my-groups-empty')).toBeVisible();
  await expect(page.getByTestId('my-group-row')).toHaveCount(0);
});

test('?codigo= prefills the field normalized, and /unirse is behind the auth gate', async ({
  page,
}) => {
  const code = await teacherWithGroup();

  // Anonymous: the gate, no form.
  await openHydrated(page, '/unirse');
  await expect(page.getByTestId('auth-gate')).toHaveAttribute('data-auth', 'anonymous');
  await expect(page.getByTestId('join-group-form')).toHaveCount(0);

  const studentEmail = uniqueEmail('unirse-prefill');
  await signUp('student', 'Estudiante prellenado', studentEmail);
  await signInOnPage(page, studentEmail);

  const lower = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();
  await openHydrated(page, `/unirse?codigo=${lower}`);
  await expect(page.getByLabel(aula.join.code, { exact: true })).toHaveValue(code);
  await page.getByRole('button', { name: aula.join.submit, exact: true }).click();
  await page.waitForURL('**/cuenta');
  await expect(page.getByTestId('my-group-list')).toContainText(GROUP_NAME);
});

test('deleting the account ends the session and the same credentials no longer work', async ({
  page,
}) => {
  const studentEmail = uniqueEmail('unirse-delete');
  await signUp('student', 'Estudiante que se va', studentEmail);
  await signInOnPage(page, studentEmail);

  // The button only enables once ELIMINAR is typed exactly.
  await openHydrated(page, '/cuenta');
  await page.getByTestId('delete-account-start').click();
  await expect(page.getByTestId('delete-account-submit')).toBeDisabled();
  await page.getByLabel(auth.deleteAccount.confirmLabel, { exact: true }).fill('eliminar');
  await expect(page.getByTestId('delete-account-submit')).toBeDisabled();
  await page.getByLabel(auth.deleteAccount.confirmLabel, { exact: true }).fill('ELIMINAR');
  await expect(page.getByTestId('delete-account-submit')).toBeEnabled();

  await page.getByTestId('delete-account-submit').click();
  await page.waitForURL('**/?cuenta=eliminada');
  await expect(page.getByTestId('account-deleted')).toContainText(auth.deleteAccount.done);

  // The session is gone: /cuenta shows the auth gate again.
  await openHydrated(page, '/cuenta');
  await expect(page.getByTestId('auth-gate')).toHaveAttribute('data-auth', 'anonymous');

  // And the same credentials no longer sign in.
  const { error } = await anonClient().auth.signInWithPassword({
    email: studentEmail,
    password: E2E_PASSWORD,
  });
  expect(error).not.toBeNull();
});
