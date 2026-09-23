import { expect, test } from '@playwright/test';

// T-0.1 (#255, point 3): the minimal e2e of the real topic m00-t01. The layout lives in
// tema.spec.ts on the /dev/tema fixture; this only checks that the topic loads with no page
// error, mounts the widgets of its spec and has its 4 exercises. With no session «Mi robot» is
// the reference robot, so the «Al robot» formulas show 628.3 and 20.94 rad/s.
const TOPIC_URL = '/ruta/ruta-1/m00/t01';

test('m00-t01 loads, mounts its widgets and has 4 exercises', async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  await page.goto(TOPIC_URL);
  // `.first()`: in `astro dev` the dev toolbar adds its own `h1`s after the page's.
  await expect(page.locator('h1').first()).toBeVisible();

  const rotation = page.locator('[data-topic-widget="RotationWidget"]');
  await expect(rotation.locator('canvas, svg').first()).toBeVisible();
  await expect(
    page.locator('[data-topic-widget="MyRobotWidget"]').getByTestId('my-robot-form'),
  ).toBeVisible();
  await expect(page.locator('[data-robot-formula="ruta-1/m00-t01/omega-motor"]')).toContainText(
    '628.3',
  );
  await expect(page.locator('[data-robot-formula="ruta-1/m00-t01/omega-rueda"]')).toContainText(
    '20.94',
  );

  await expect(page.getByTestId('exercise')).toHaveCount(4);

  expect(pageErrors).toEqual([]);
});
