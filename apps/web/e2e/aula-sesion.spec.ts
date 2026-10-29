import { expect, test, type Browser, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import aula from '../../../packages/i18n/locales/es/aula.json' with { type: 'json' };
import { E2E_PASSWORD, joinGroup, signUp, type TestUser } from './helpers/supabase';

// #685: the phone as a controller of the 3D track, approved by the teacher. One teacher in the
// browser (the PC), a student of the group (the phone) and a student of another group, who cannot
// join. Users are created from Node with the anon key, like the other classroom specs.
const TEACHER_NAME = 'Docente E2E';

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${test.info().workerIndex}@example.com`;
}

async function fillLogin(page: Page, email: string): Promise<void> {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByLabel(auth.fields.password, { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: auth.login.submit, exact: true }).click();
}

async function signInOnPage(page: Page, email: string): Promise<void> {
  await page.goto('/auth/login');
  await fillLogin(page, email);
  await page.waitForURL('**/cuenta');
}

async function phoneOf(browser: Browser, user: TestUser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await context.newPage();
  await signInOnPage(page, user.email);
  return page;
}

async function createGroup(teacher: TestUser, name: string): Promise<string> {
  const { data, error } = await teacher.client
    .from('groups')
    .insert({ owner_id: teacher.userId, name })
    .select('invite_code')
    .single();
  if (error !== null) throw new Error(error.message);
  return data.invite_code;
}

const named = (template: string, name: string): string => template.replace('{{name}}', name);

test('classroom: the phone asks, the teacher approves, drives and kicks', async ({
  page,
  browser,
}) => {
  // Three users, two browsers and a 3D scene rendered in software: well over the 30 s default.
  test.setTimeout(120_000);
  const teacher = await signUp('teacher', TEACHER_NAME, uniqueEmail('sesion-docente'));
  const other = await signUp('teacher', 'Otro docente', uniqueEmail('sesion-otro'));
  const code = await createGroup(teacher, 'Grupo sesión');
  const otherCode = await createGroup(other, 'Otro grupo');
  const ana = await signUp('student', 'Ana Aula', uniqueEmail('sesion-ana'));
  const carlos = await signUp('student', 'Carlos Otro', uniqueEmail('sesion-carlos'));
  await joinGroup(ana.client, code);
  await joinGroup(carlos.client, otherCode);

  // The PC: the teacher opens the session from the 3D track and reads the link.
  await signInOnPage(page, teacher.email);
  await page.goto('/simuladores/carrito');
  await page.getByTestId('aula-toggle').click();
  await page.getByRole('button', { name: aula.session.teacher.start }).click();
  const link = await page.getByTestId('aula-link').inputValue();
  expect(link).toContain('/aula/sesion#t=');
  await expect(page.getByRole('img', { name: aula.session.teacher.qr })).toBeVisible();

  // A student of another group is refused, with no hint about why.
  const carlosPhone = await phoneOf(browser, carlos);
  await carlosPhone.goto(link);
  await expect(carlosPhone.getByTestId('phone-invalid')).toBeVisible();
  await carlosPhone.context().close();

  // Without a session the QR goes through the login and comes back with the token (#685).
  const late = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const latePhone = await late.newPage();
  await latePhone.goto(link);
  await latePhone.getByRole('link', { name: auth.gate.login, exact: true }).click();
  await fillLogin(latePhone, ana.email);
  await latePhone.waitForURL('**/aula/sesion#t=*');
  await expect(latePhone.getByTestId('phone-teacher')).toContainText(TEACHER_NAME);
  await late.close();

  // A student of the group sees who runs the session, asks and waits.
  const anaPhone = await phoneOf(browser, ana);
  await anaPhone.goto(link);
  await expect(anaPhone.getByTestId('phone-teacher')).toContainText(TEACHER_NAME);
  await anaPhone.getByRole('button', { name: aula.session.phone.ask }).click();
  await expect(anaPhone.getByTestId('phone-waiting')).toBeVisible();

  // The teacher approves and gives her the control: the pad appears on the phone.
  await page.getByRole('button', { name: named(aula.session.teacher.approve, 'Ana Aula') }).click();
  await expect(anaPhone.getByTestId('phone-approved')).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: named(aula.session.teacher.drive, 'Ana Aula') }).click();
  await expect(anaPhone.getByTestId('phone-pad')).toBeVisible({ timeout: 15_000 });

  // Holding «Avanzar» reaches the PC; letting go stops it.
  const forward = anaPhone.getByRole('button', { name: aula.session.phone.forward });
  const box = await forward.boundingBox();
  if (box === null) throw new Error('forward button has no box');
  await anaPhone.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await anaPhone.mouse.down();
  await expect(page.getByTestId('aula-last')).toHaveText('0 · 1', { timeout: 15_000 });
  await anaPhone.mouse.up();
  await expect(page.getByTestId('aula-last')).toHaveText('0 · 0', { timeout: 15_000 });

  // Kicked: the phone says so, the row is no longer approved and she cannot ask again.
  await page.getByRole('button', { name: named(aula.session.teacher.kick, 'Ana Aula') }).click();
  await expect(anaPhone.getByTestId('phone-kicked')).toBeVisible({ timeout: 15_000 });
  const { data } = await ana.client.from('session_participants').select('status');
  expect(data?.map((row) => row.status)).toEqual(['kicked']);
  const again = await ana.client.rpc('request_join_session', {
    session_token: link.split('#t=')[1] ?? '',
    confirm: true,
  });
  expect(again.data).toEqual([]);
  await anaPhone.context().close();
});
