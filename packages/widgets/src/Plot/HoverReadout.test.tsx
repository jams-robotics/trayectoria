import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { HoverReadout } from './HoverReadout';

const t = (key: string, params?: Record<string, unknown>): string =>
  params === undefined ? key : `${key} ${JSON.stringify(params)}`;

const DATA = [new Float64Array([0, 1, 2]), new Float64Array([10, 20, 30])];

function renderReadout(): void {
  render(
    <HoverReadout
      data={DATA}
      xRange={[0, 2]}
      plotArea={{ left_px: 0, width_px: 200, top_px: 0, height_px: 100 }}
      series={[{ key: 'a', label: 'a', unit: 'm' }]}
      xUnit="s"
      t={t}
    />,
  );
}

describe('HoverReadout', () => {
  it('shows nothing until the layer is focused, then the last sample', async () => {
    renderReadout();
    expect(screen.queryByRole('status')).toBeNull();
    await userEvent.tab();
    expect(screen.getByRole('status')).toHaveTextContent('"value":"2.00"');
    expect(screen.getByRole('status')).toHaveTextContent('"value":"30.00"');
  });

  it('moves one sample with the arrow keys', async () => {
    renderReadout();
    await userEvent.tab();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('status')).toHaveTextContent('"value":"20.00"');
  });
});
