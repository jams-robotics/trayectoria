import { expect, test } from '@playwright/test';

// #382: in m03-t02, pressing «Reproducir» on PowerWidget made the scene jump. The figure under the
// `E_p` bar changes its count of characters as the energy grows (0.00 J, 0.0432 J, 0.475 J…), the
// bar column is sized by that text and the scene next to it takes the rest of the row, so every
// change of length resized the canvas. Sampled on every frame from the click, the box of the
// scene must stay the same as before it.
const TOPIC_URL = '/ruta/ruta-1/m03/t02';
const WIDGET = '[data-topic-widget="PowerWidget"]';
/** Frames sampled after the click: about 1 s of playback at 60 Hz. */
const FRAMES = 60;

interface Box {
  x_px: number;
  y_px: number;
  width_px: number;
  height_px: number;
}

test('pressing Reproducir in m03-t02 keeps the scene of PowerWidget still', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(TOPIC_URL);
  const widget = page.locator(WIDGET).first();
  const canvas = widget.locator('canvas').first();
  await expect(canvas).toBeVisible();
  await widget.scrollIntoViewIfNeeded();
  const before: Box = await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x_px: rect.x, y_px: rect.y, width_px: rect.width, height_px: rect.height };
  });
  // Start sampling before the click so the first frame of the playback is also covered.
  const sampled = canvas.evaluate(
    (element, frames) =>
      new Promise<Box[]>((resolve) => {
        const boxes: Box[] = [];
        const sample = (): void => {
          const rect = element.getBoundingClientRect();
          boxes.push({ x_px: rect.x, y_px: rect.y, width_px: rect.width, height_px: rect.height });
          if (boxes.length < frames) requestAnimationFrame(sample);
          else resolve(boxes);
        };
        requestAnimationFrame(sample);
      }),
    FRAMES,
  );
  await widget.getByRole('button', { name: 'Reproducir' }).click();
  const boxes = await sampled;
  await expect(page.getByTestId('power-bar-value').first()).not.toHaveText(/^0\.00 J/);
  for (const box of boxes) expect(box).toEqual(before);
});
