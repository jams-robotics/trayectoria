import { expect, test, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import aula from '../../../packages/i18n/locales/es/aula.json' with { type: 'json' };
import { E2E_PASSWORD, joinGroup, signUp } from './helpers/supabase';

// F3-02a acceptance criteria. Runs against the local Supabase stack, where email confirmations
// are disabled (supabase/config.toml), so sign-up returns a session directly. The students are
// created from Node with the anon key (e2e/helpers/supabase.ts), which is much faster than
// driving three browser sessions and exercises `join_group` the same way the browser would.
const GROUP_NAME = 'Mecatrónica 2026-2 · A';

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

test('teacher: creates a group, regenerates its code, sees the members and removes one', async ({
  page,
}) => {
  const teacherEmail = uniqueEmail('aula-teacher');
  await signUp('teacher', 'Docente E2E', teacherEmail);
  await signInOnPage(page, teacherEmail);

  await openHydrated(page, '/aula');
  await expect(page.getByTestId('groups-empty')).toBeVisible();

  // Create the group and land on its detail: /aula?grupo=<uuid> is a deep link.
  await page.getByRole('button', { name: aula.groups.new }).click();
  await page.getByLabel(aula.create.name, { exact: true }).fill(GROUP_NAME);
  await page.getByRole('button', { name: aula.create.submit, exact: true }).click();
  await expect(page.getByTestId('group-title')).toHaveText(GROUP_NAME);
  await expect(page).toHaveURL(/\/aula\?grupo=[0-9a-f-]{36}$/);

  // An 8-character code of the alphabet, and "Regenerar" replaces it with a different one.
  const code = page.getByTestId('invite-code');
  const firstCode = ((await code.textContent()) ?? '').trim();
  expect(firstCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  await page.getByRole('button', { name: aula.invite.regenerate }).click();
  await expect(code).not.toHaveText(firstCode);
  const secondCode = ((await code.textContent()) ?? '').trim();
  expect(secondCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);

  // Two students join with join_group and show up in the members list.
  const ana = await signUp('student', 'Ana Lucía', uniqueEmail('aula-ana'));
  const bruno = await signUp('student', 'Bruno', uniqueEmail('aula-bruno'));
  await joinGroup(ana.client, secondCode);
  await joinGroup(bruno.client, secondCode);

  await page.reload();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
  await expect(page.getByTestId('member-row')).toHaveCount(2);
  await expect(page.getByTestId('member-list')).toContainText('Ana Lucía');
  await expect(page.getByTestId('member-list')).toContainText('Bruno');

  // The old code no longer works: regenerating it revoked it.
  const carla = await signUp('student', 'Carla', uniqueEmail('aula-carla'));
  await expect(joinGroup(carla.client, firstCode)).rejects.toThrow();

  // Removing a member takes the row out of the list, after the inline confirmation.
  await page
    .getByRole('button', { name: aula.members.remove.replace('{{name}}', 'Ana Lucía') })
    .click();
  await page.getByRole('button', { name: aula.members.removeYes, exact: true }).first().click();
  await expect(page.getByTestId('member-row')).toHaveCount(1);
  await expect(page.getByTestId('member-list')).not.toContainText('Ana Lucía');
});

test('a group of another teacher is not found, and the back link returns to the list', async ({
  page,
}) => {
  const owner = await signUp('teacher', 'Docente propietaria', uniqueEmail('aula-owner'));
  // The invite code carries a unique index, so a fixed one would collide with an earlier run.
  const { data, error } = await owner.client
    .from('groups')
    .insert({ owner_id: owner.userId, name: 'Física II', invite_code: uniqueInviteCode() })
    .select('id')
    .single();
  expect(error).toBeNull();
  const foreignGroupId: string = data?.id ?? '';
  expect(foreignGroupId).not.toBe('');

  const intruderEmail = uniqueEmail('aula-intruder');
  await signUp('teacher', 'Otro docente', intruderEmail);
  await signInOnPage(page, intruderEmail);

  await openHydrated(page, `/aula?grupo=${foreignGroupId}`);
  await expect(page.getByTestId('group-not-found')).toBeVisible();
  await expect(page.getByTestId('group-not-found')).toContainText(aula.groups.notFound);
  // RLS never hands the invite code over: the page shows no code at all.
  await expect(page.getByTestId('invite-code')).toHaveCount(0);

  await page.getByRole('button', { name: aula.groups.back }).click();
  await expect(page).toHaveURL(/\/aula$/);
  await expect(page.getByTestId('group-not-found')).toHaveCount(0);
});

test('a student sees only the teachers notice, and an anonymous visitor the auth CTA', async ({
  page,
}) => {
  const studentEmail = uniqueEmail('aula-student');
  await signUp('student', 'Estudiante E2E', studentEmail);
  await signInOnPage(page, studentEmail);

  await openHydrated(page, '/aula');
  await expect(page.getByTestId('aula-only-teachers')).toContainText(aula.onlyTeachers);
  await expect(page.getByTestId('group-list')).toHaveCount(0);
  await expect(page.getByRole('button', { name: aula.groups.new })).toHaveCount(0);

  await openHydrated(page, '/cuenta');
  await page.getByRole('button', { name: auth.account.signOut }).click();

  await openHydrated(page, '/aula');
  await expect(page.getByTestId('auth-gate')).toHaveAttribute('data-auth', 'anonymous');
  await expect(page.getByRole('link', { name: auth.gate.register })).toBeVisible();
  await expect(page.getByTestId('aula-only-teachers')).toHaveCount(0);
});
