import { expect, test, type Locator, type Page } from '@playwright/test';

// #646: a 390 px, la versión sustituida de una fórmula larga no desborda la tarjeta. Si no cabe,
// se alinea a la izquierda y se desplaza en horizontal dentro de la tarjeta, sin desplazamiento
// de página. Sin sesión «Mi robot» es el robot de referencia, así que los valores son fijos.
const CASES = [
  { url: '/ruta/ruta-1/m02/t04', calc: 'ruta-1/m02-t04/wheel-torque' },
  { url: '/ruta/ruta-1/m02/t03', calc: 'ruta-1/m02-t03/max-curve-speed' },
] as const;

test.use({ viewport: { width: 390, height: 844 } });

async function openFormula(page: Page, url: string, calc: string): Promise<Locator> {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(url);
  await page.addStyleTag({ content: 'astro-dev-toolbar { display: none !important; }' });
  const formula = page.locator(`[data-robot-formula="${calc}"]`);
  await expect(formula.locator('[role="math"]')).toHaveCount(2, { timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  return formula;
}

/** Bordes de la tarjeta y de cada fórmula, y si alguna caja desborda a su contenedor. */
function measure(formula: Locator) {
  return formula.evaluate((root) => {
    const card = root.querySelector<HTMLElement>('[data-block="true"]');
    if (card === null) throw new Error('no formula card');
    const cardBox = card.getBoundingClientRect();
    const maths = [...card.querySelectorAll<HTMLElement>('[role="math"]')].map((math) => {
      const box = math.getBoundingClientRect();
      const scroller = math.parentElement as HTMLElement;
      return {
        left_px: box.left,
        scrollerLeft_px: scroller.getBoundingClientRect().left,
        scrollerRight_px: scroller.getBoundingClientRect().right,
        overflowsScroller: scroller.scrollWidth > scroller.clientWidth,
      };
    });
    return {
      cardLeft_px: cardBox.left,
      cardRight_px: cardBox.right,
      cardOverflows: card.scrollWidth > card.clientWidth,
      pageOverflows: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      maths,
    };
  });
}

for (const { url, calc } of CASES) {
  test(`${calc} fits its card at 390 px with its start visible`, async ({ page }) => {
    const formula = await openFormula(page, url, calc);
    const m = await measure(formula);
    expect(m.pageOverflows).toBe(false);
    expect(m.cardOverflows).toBe(false);
    for (const math of m.maths) {
      // El inicio de la fórmula está dentro de la tarjeta y de su caja de desplazamiento.
      expect(math.left_px).toBeGreaterThanOrEqual(m.cardLeft_px);
      expect(math.left_px).toBeGreaterThanOrEqual(math.scrollerLeft_px - 0.5);
      expect(math.scrollerRight_px).toBeLessThanOrEqual(m.cardRight_px);
    }
    // La sustituida es la que no cabe: se desplaza dentro de su caja.
    expect(m.maths[1]?.overflowsScroller).toBe(true);
    const name = calc.split('/').at(-1) ?? calc;
    await expect(formula).toHaveScreenshot(`Formula-390-${name}.png`);
  });
}
