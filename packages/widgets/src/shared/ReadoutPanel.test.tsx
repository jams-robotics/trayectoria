import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReadoutPanel } from './ReadoutPanel';
import type { ReadoutRow } from './ReadoutPanel';

const TITLE = String(1);
const rows = (count: number): ReadoutRow[] =>
  Array.from({ length: count }, (_, i): ReadoutRow => [`term ${String(i)}`, String(i)]);

describe('ReadoutPanel (v1.5)', () => {
  it('shows a short panel whole, with no «Más datos»', () => {
    render(<ReadoutPanel title={TITLE} rows={rows(6)} />);
    expect(screen.queryByTestId('readout-more')).toBeNull();
  });

  it('folds the rows after the first five of a long panel behind «Más datos»', () => {
    render(<ReadoutPanel title={TITLE} rows={rows(8)} />);
    expect(screen.getByText('Más datos')).toBeInTheDocument();
    expect(screen.getByTestId('readout-more').textContent).toContain('term 5');
    expect(screen.getByTestId('readout-more').textContent).not.toContain('term 4');
  });

  it('honours visibleRows', () => {
    render(<ReadoutPanel title={TITLE} rows={rows(4)} visibleRows={2} />);
    expect(screen.getByTestId('readout-more').textContent).toContain('term 2');
  });
});
