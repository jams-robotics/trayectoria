import { expect, test, type Locator, type Page } from '@playwright/test';

import widgets from '../../../packages/i18n/locales/es/widgets.json' with { type: 'json' };

// F6-01 acceptance criteria on /dev/tema, an MDX outside content/es/ rendered with the topic MDX
// map, with no session: «Mi robot» lives in `localStorage` (#95, decision 2), so Supabase is not
// needed. The golden values are those of the ticket: ω_rueda = 628.3/30 = 20.94 rad/s with the
// reference robot.
const MY_ROBOT = widgets.MyRobotWidget;

async function openFixture(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/dev/tema');
  // The islands are `client:only`: the DOM is empty until React mounts them.
  await expect(page.getByTestId('my-robot-form')).toBeVisible();
  return errors;
}

function robotFormula(page: Page): Locator {
  return page.locator('[data-robot-formula="demo/omega-rueda"]');
}

test('the MDX mounts RotationWidget and MyRobotWidget with no hydration error', async ({
  page,
}) => {
  const errors = await openFixture(page);

  const rotation = page.locator('[data-topic-widget="RotationWidget"]');
  await expect(rotation.getByRole('status').first()).toBeAttached();
  await expect(rotation.locator('canvas, svg').first()).toBeVisible();
  const myRobot = page.locator('[data-topic-widget="MyRobotWidget"]');
  await expect(myRobot.getByTestId('my-robot-form')).toHaveAttribute(
    'aria-label',
    MY_ROBOT.formTitle,
  );
  expect(errors.filter((text) => /hydrat/i.test(text))).toEqual([]);
});

test('RobotFormula substitutes «Mi robot» and follows a new gear ratio', async ({ page }) => {
  await openFixture(page);
  const formula = robotFormula(page);
  await expect(formula).toContainText('628.3');
  await expect(formula).toContainText('20.94');

  const form = page.getByTestId('my-robot-form');
  const gearRatio = form.locator('[data-field="gearRatio"]').getByRole('textbox');
  await expect
    .poll(async () => {
      await gearRatio.fill('15');
      return gearRatio.inputValue();
    })
    .toBe('15');
  await form.getByRole('button', { name: MY_ROBOT.save }).click();

  // 628.3/15 = 41.89 rad/s.
  await expect(formula).toContainText('41.89');
  await expect(formula).not.toContainText('20.94');
});
