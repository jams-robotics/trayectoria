import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import sims from '../../../packages/i18n/locales/es/sims.json' with { type: 'json' };
import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import { E2E_PASSWORD, signUp } from './helpers/supabase';
import { openEditor, openMobileSim } from './sim-movil.helpers';

// F4-06 (#191, decisión 6): las pistas guardadas de `/simuladores/movil`. Con sesión se guarda en
// `public.tracks` y otro estudiante no la ve (RLS del propietario, docs/ARCHITECTURE.md §5.2);
// sin sesión, en el store local del navegador. La vuelta completa es la del criterio del ticket:
// guardar, recargar, elegirla en «Mis pistas» y borrarla.
//
// Las cuentas se crean desde Node con la clave `anon` (`e2e/helpers/supabase.ts`); el inicio de
// sesión va por la interfaz, que es lo que deja la sesión en el navegador.

const TRACKS = sims.mobilePage.myTracks;
const SAVE = sims.trackEditor.save;

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${test.info().workerIndex}@example.com`;
}

/** Un nombre de pista distinto por ejecución: el índice `(owner_id, name)` es único. */
function uniqueTrackName(prefix: string): string {
  return `${prefix} ${String(Date.now())}-${String(test.info().workerIndex)}`;
}

/**
 * Astro quita el atributo `ssr` de una isla en cuanto React la hidrata; escribir antes lo
 * desharía la hidratación (los campos controlados arrancan vacíos).
 */
async function openHydrated(page: Page, pathname: string): Promise<void> {
  await page.goto(pathname);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((island) => !island.hasAttribute('ssr')),
  );
}

/** Inicia sesión por la interfaz, que es lo que pone la sesión en el almacenamiento del navegador. */
async function signInOnPage(page: Page, email: string): Promise<void> {
  await openHydrated(page, '/auth/login');
  await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
  await page.getByLabel(auth.fields.password, { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole('button', { name: auth.login.submit, exact: true }).click();
  await page.waitForURL('**/cuenta');
}

/** Abre el editor con la pista que se está simulando y la guarda con el nombre `name`. */
async function saveCurrentTrack(page: Page, name: string): Promise<void> {
  await openEditor(page, 'track-source-edit');
  await page.getByTestId('track-editor-save-track').click();
  await page.getByTestId('track-editor-save-name').fill(name);
  await page.getByTestId('track-editor-save-track-confirm').click();
  await expect(page.getByTestId('toast')).toContainText(SAVE.saved);
  await page.getByTestId('track-editor-back').click();
}

/** El selector de pista, con el panel Pista abierto si la maqueta lo tiene plegado. */
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

    // Recargar: la pista está en la cuenta, no en el estado de la página.
    await openMobileSim(page);
    const select = await trackSelect(page);
    // Un `<optgroup>` dentro de un `<select>` cerrado no está «visible» para Playwright, así que
    // se comprueba que esté en el DOM con su etiqueta y con la pista dentro.
    await expect(select.locator('optgroup', { hasText: name })).toHaveAttribute(
      'label',
      TRACKS.group,
    );
    await expect(select.getByRole('option', { name })).toBeAttached();

    // Elegirla la carga como pista actual y la simulación sigue corriendo sobre ella.
    await select.selectOption({ label: name });
    await expect(page.getByTestId('line-follower-view')).toBeVisible();

    // Otro estudiante no ve la pista: RLS la acota a su dueño.
    const otherEmail = uniqueEmail('pistas-other');
    await signUp('student', 'Otro E2E', otherEmail);
    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await signInOnPage(otherPage, otherEmail);
    await openMobileSim(otherPage);
    const otherSelect = await trackSelect(otherPage);
    await expect(otherSelect.getByRole('option', { name })).toHaveCount(0);
    await otherContext.close();

    // Borrarla pide confirmación y la quita del grupo.
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
