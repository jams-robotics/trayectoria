import { expect, test, type Page } from '@playwright/test';

// #409 acceptance criterion on /dev/tema-seguidor, an MDX outside content/es/ rendered with the
// topic MDX map, with no session: the robot is «Mi robot» of the browser, so Supabase is not
// needed. The first widget carries the serializable props of docs/WIDGETS.md, the second one is
// the compact viewer.
async function openFixture(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/dev/tema-seguidor');
  // The islands are `client:only`: the DOM is empty until React mounts them.
  await expect(page.getByTestId('line-follower-view')).toHaveCount(2, { timeout: 15_000 });
  return errors;
}

test('the MDX mounts LineFollowerWidget with no page or hydration error', async ({ page }) => {
  const errors = await openFixture(page);

  await expect(page.locator('[data-topic-widget="LineFollowerWidget"]')).toHaveCount(2);
  expect(errors).toEqual([]);
});

test('the MDX props reach the widget: controller, gains, plots and compact', async ({ page }) => {
  await openFixture(page);
  const [full, compact] = [
    page.locator('[data-topic-widget="LineFollowerWidget"]').nth(0),
    page.locator('[data-topic-widget="LineFollowerWidget"]').nth(1),
  ];

  await expect(full.getByRole('button', { name: 'P', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(full.getByRole('slider', { name: /^Kp/ })).toHaveAttribute('aria-valuenow', '12');
  await expect(full.getByRole('slider', { name: /^Velocidad base/ })).toHaveAttribute(
    'aria-valuenow',
    '10',
  );
  // `Kp` is not a key of the code: it is ignored and adds no slider.
  await expect(full.getByRole('slider')).toHaveCount(2);
  await expect(full.getByTestId('plot-error')).toBeVisible();
  await expect(full.getByTestId('line-follower-plots').locator(':scope > div')).toHaveCount(1);

  await expect(compact.getByTestId('line-follower-view')).toBeVisible();
  await expect(compact.getByRole('slider')).toHaveCount(0);
  await expect(compact.getByTestId('line-follower-controller')).toHaveCount(0);
});
