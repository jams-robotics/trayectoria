import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import sims from '../../../packages/i18n/locales/es/sims.json' with { type: 'json' };
import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import { E2E_PASSWORD, signUp } from './helpers/supabase';
import { openEditor, openMobileSim } from './sim-movil.helpers';

// F4-06 (#191, decision 6): the saved tracks of `/simuladores/movil`. With a session the track
// goes to `public.tracks` and another student does not see it (owner RLS, docs/ARCHITECTURE.md
// §5.2); without one, to the local store of the browser. The whole round trip is the acceptance
// criterion of the ticket: save, reload, pick it under «Mis pistas» and delete it.
//
// The accounts are created from Node with the `anon` key (`e2e/helpers/supabase.ts`); signing in
// goes through the interface, which is what puts the session in the browser.

const TRACKS = sims.mobilePage.myTracks;
const SAVE = sims.trackEditor.save;

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${test.info().workerIndex}@example.com`;
}

/** A different track name per run: the `(owner_id, name)` index is unique. */
function uniqueTrackName(prefix: string): string {
  return `${prefix} ${String(Date.now())}-${String(test.info().workerIndex)}`;
}

/**
 * Astro removes the `ssr` attribute of an island once React has hydrated it; typing before that
 * would be undone by hydration (controlled inputs start empty).
 */
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

/** Opens the editor on the track being simulated and saves it under `name`. */
async function saveCurrentTrack(page: Page, name: string): Promise<void> {
  await openEditor(page, 'track-source-edit');
  await page.getByTestId('track-editor-save-track').click();
  await page.getByTestId('track-editor-save-name').fill(name);
  await page.getByTestId('track-editor-save-track-confirm').click();
  await expect(page.getByTestId('toast')).toContainText(SAVE.saved);
  await page.getByTestId('track-editor-back').click();
}

/** The track picker, opening the Pista panel first when the layout keeps it collapsed. */
async function trackSelect(page: Page) {
  const select = page.getByTestId('track-source-select');
  if (!(await select.isVisible())) {
    await page.getByRole('button', { name: /^Pista/ }).click();
  }
  return select;
}

test.describe('Mis pistas (#191)', () => {
  test('con sesión: guardar, recargar, elegirla y borrarla; otro usuario no la ve', async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail('pistas-owner');
    await signUp('student', 'Dueña E2E', email);
    await signInOnPage(page, email);
    const name = uniqueTrackName('Óvalo guardado');

    await openMobileSim(page);
    await saveCurrentTrack(page, name);

    // Reload: the track lives in the account, not in the state of the page.
    await openMobileSim(page);
    const select = await trackSelect(page);
    // An `<optgroup>` inside a closed `<select>` is not "visible" to Playwright, so what is
    // checked is that it is in the DOM with its label and with the track inside it.
    await expect(select.locator('optgroup', { hasText: name })).toHaveAttribute(
      'label',
      TRACKS.group,
    );
    await expect(select.getByRole('option', { name })).toBeAttached();

    // Picking it loads it as the current track and the simulation carries on over it.
    await select.selectOption({ label: name });
    await expect(page.getByTestId('line-follower-view')).toBeVisible();

    // Another student does not see the track: RLS scopes it to its owner.
    const otherEmail = uniqueEmail('pistas-other');
    await signUp('student', 'Otro E2E', otherEmail);
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await signInOnPage(otherPage, otherEmail);
    await openMobileSim(otherPage);
    const otherSelect = await trackSelect(otherPage);
    await expect(otherSelect.getByRole('option', { name })).toHaveCount(0);
    await otherContext.close();

    // Deleting it asks for confirmation and takes it out of the group.
    await page.getByTestId('my-tracks-delete').click();
    await page.getByRole('button', { name: TRACKS.confirmYes, exact: true }).click();
    await expect(select.getByRole('option', { name })).toHaveCount(0);
  });

  test('sin sesión: la pista guardada sigue en «Mis pistas» tras recargar', async ({ page }) => {
    const name = uniqueTrackName('Local');
    await openMobileSim(page);
    await saveCurrentTrack(page, name);

    await openMobileSim(page);
    const select = await trackSelect(page);
    await expect(select.locator('optgroup', { hasText: name })).toHaveAttribute(
      'label',
      TRACKS.group,
    );
    await expect(select.getByRole('option', { name })).toBeAttached();

    await select.selectOption({ label: name });
    await page.getByTestId('my-tracks-delete').click();
    await page.getByRole('button', { name: TRACKS.confirmYes, exact: true }).click();
    await expect(select.getByRole('option', { name })).toHaveCount(0);
  });
});
