import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import aula from '../../../packages/i18n/locales/es/aula.json' with { type: 'json' };
import { E2E_PASSWORD, joinGroup, signUp, type TestUser } from './helpers/supabase';

// F3-02b acceptance criteria. The teacher drives the browser; the two students are created from
// Node with the anon key (e2e/helpers/supabase.ts), and the one who finishes the topic writes
// its own `progress` row with its own session, exactly as the topic page does under RLS.
const GROUP_NAME = 'Física 3ºA';
const TOPIC_ID = 'ruta-1/m00-t01';
const TOPIC_TITLE = 'Unidades y magnitudes';

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

/**
 * Completes a topic for a student: the row goes in with that student's own client, which is the
 * only session the "progress: owner inserts" policy accepts for it.
 */
async function completeTopic(student: TestUser, topicId: string): Promise<void> {
  const { error } = await student.client.from('progress').upsert({
    user_id: student.userId,
    topic_id: topicId,
    status: 'completed',
    best_score: 1,
    attempts: 1,
    completed_at: new Date().toISOString(),
  });
  expect(error).toBeNull();
}

/** The status cell of one topic for one student, once the table has rendered. */
function cell(page: Page, topicId: string, columnIndex: number) {
  return page
    .locator(`[data-testid="progress-row"][data-topic="${topicId}"] [data-testid="progress-cell"]`)
    .nth(columnIndex);
}

test('teacher: the table shows who completed the topic and the CSV carries the same data', async ({
  page,
}) => {
  const teacherEmail = uniqueEmail('progreso-teacher');
  await signUp('teacher', 'Docente progreso', teacherEmail);
  await signInOnPage(page, teacherEmail);

  await openHydrated(page, '/aula');
  await page.getByRole('button', { name: aula.groups.new }).click();
  await page.getByLabel(aula.create.name, { exact: true }).fill(GROUP_NAME);
  await page.getByRole('button', { name: aula.create.submit, exact: true }).click();
  await expect(page.getByTestId('group-title')).toHaveText(GROUP_NAME);

  const code = ((await page.getByTestId('invite-code').textContent()) ?? '').trim();
  const ana = await signUp('student', 'Ana Lucía', uniqueEmail('progreso-ana'));
  const bruno = await signUp('student', 'Bruno', uniqueEmail('progreso-bruno'));
  await joinGroup(ana.client, code);
  await joinGroup(bruno.client, code);
  await completeTopic(ana, TOPIC_ID);

  await openHydrated(page, page.url().slice(page.url().indexOf('/aula')));
  await expect(page.getByTestId('progress-table')).toBeVisible();

  // The members list is ordered by `joined_at`, so Ana is the first column and Bruno the second.
  await expect(page.getByTestId('progress-column')).toHaveCount(2);
  await expect(page.getByTestId('progress-column').first()).toHaveText('Ana Lucía');
  await expect(page.getByTestId('progress-column').nth(1)).toHaveText('Bruno');

  // C for the student who completed it, only a border for the other one.
  await expect(cell(page, TOPIC_ID, 0)).toHaveAttribute('data-state', 'completed');
  await expect(cell(page, TOPIC_ID, 0)).toContainText('C');
  await expect(cell(page, TOPIC_ID, 1)).toHaveAttribute('data-state', 'pending');

  // The summary counts the whole route: 1/N for Ana and 0/N for Bruno.
  const total = await page.getByTestId('progress-row').count();
  expect(total).toBeGreaterThan(1);
  await expect(page.getByTestId('progress-summary').first()).toContainText(`1/${total}`);
  await expect(page.getByTestId('progress-summary').nth(1)).toContainText(`0/${total}`);

  // The state is never colour alone: the cell carries the text of its status.
  await expect(cell(page, TOPIC_ID, 0)).toContainText(TOPIC_TITLE);

  // Exporting downloads a file with the BOM, the exact header and Ana's completed row.
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-csv').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^progreso-fisica-3a-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = await readFile(await download.path(), 'utf8');

  expect(
    csv.startsWith('﻿estudiante,tema,estado,mejor_puntuacion,intentos,completado_en\r\n'),
  ).toBe(true);
  expect(csv).toContain(`Ana Lucía,${TOPIC_ID},completado,1.00,1,`);
  expect(csv).toContain(`Bruno,${TOPIC_ID},pendiente,,0,`);
  await expect(page.getByRole('status')).toContainText(aula.progress.exported);
});

test('a student cannot read the progress of another student', async () => {
  const ana = await signUp('student', 'Ana aislada', uniqueEmail('progreso-aislada'));
  const bruno = await signUp('student', 'Bruno aislado', uniqueEmail('progreso-aislado'));
  await completeTopic(ana, TOPIC_ID);

  // The "progress: own or taught reads" policy of migration 0002, checked end to end here and in
  // pgTAP (`supabase/tests/progress_isolation.sql`): Bruno's session sees none of Ana's rows.
  const { data, error } = await bruno.client
    .from('progress')
    .select('user_id')
    .in('user_id', [ana.userId]);

  expect(error).toBeNull();
  expect(data).toEqual([]);
});
