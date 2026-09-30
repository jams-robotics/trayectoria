import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

// #545: el menú móvil se despliega justo bajo la cabecera, sobre un velo, y no pegado al borde
// inferior de la pantalla. Se cierra con Esc, tocando el velo, saliendo de él con Tab o con el
// mismo botón, que mientras está abierto dice «Cerrar». No necesita Supabase.

/** Viewport móvil de las maquetas (docs/DESIGN.md §9). */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

/** Alto de la cabecera (docs/DESIGN.md §5, Navegación). */
const HEADER_HEIGHT_PX = 56;

/** Abre la portada a 390 px con el menú cerrado. */
async function openHome(page: Page): Promise<void> {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/');
  await expect(page.locator('#nav-menu')).toHaveAttribute('aria-expanded', 'false');
}

test.describe('Menú móvil (#545)', () => {
  test('se abre bajo la cabecera, con el foco en el primer enlace y «Cerrar» en el botón', async ({
    page,
  }) => {
    await openHome(page);
    const button = page.locator('#nav-menu');
    const list = page.locator('#nav-links');
    await expect(list).toBeHidden();

    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(button).toHaveText('Cerrar');
    await expect(list).toBeVisible();
    await expect(page.locator('#nav-scrim')).toBeVisible();
    await expect(list.getByRole('link').first()).toBeFocused();

    // Cuelga del borde inferior de la cabecera, no del de la pantalla.
    const box = await list.boundingBox();
    expect(box?.y).toBeCloseTo(HEADER_HEIGHT_PX, -1);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThan(MOBILE_VIEWPORT.height / 2);

    await button.click();
    await expect(list).toBeHidden();
    await expect(button).toHaveText('Menú');
  });

  test('Esc lo cierra y devuelve el foco al botón', async ({ page }) => {
    await openHome(page);
    await page.locator('#nav-menu').click();
    await expect(page.locator('#nav-links')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('#nav-links')).toBeHidden();
    await expect(page.locator('#nav-scrim')).toBeHidden();
    await expect(page.locator('#nav-menu')).toBeFocused();
    await expect(page.locator('#nav-menu')).toHaveAttribute('aria-expanded', 'false');
  });

  test('tocar fuera, sobre el velo, lo cierra', async ({ page }) => {
    await openHome(page);
    await page.locator('#nav-menu').click();
    await expect(page.locator('#nav-links')).toBeVisible();

    await page.mouse.click(MOBILE_VIEWPORT.width / 2, MOBILE_VIEWPORT.height - 40);
    await expect(page.locator('#nav-links')).toBeHidden();
    await expect(page.locator('#nav-scrim')).toBeHidden();
    await expect(page.locator('#nav-menu')).toHaveText('Menú');
  });

  test('salir de la cabecera con Tab lo cierra', async ({ page }) => {
    await openHome(page);
    await page.locator('#nav-menu').click();
    const links = page.locator('#nav-links').getByRole('link');
    await links.last().focus();

    // Tras el último enlace el foco sigue en la cabecera (tema y el propio botón), así que el
    // menú sigue abierto; al salir de ella se cierra.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.locator('#nav-menu')).toBeFocused();
    await expect(page.locator('#nav-links')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator('#nav-links')).toBeHidden();
    await expect(page.locator('#nav-menu')).toHaveAttribute('aria-expanded', 'false');
  });

  test('en escritorio los enlaces siguen en la cabecera y no hay velo', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#nav-links')).toBeVisible();
    await expect(page.locator('#nav-menu')).toBeHidden();
    await expect(page.locator('#nav-scrim')).toBeHidden();
  });
});
