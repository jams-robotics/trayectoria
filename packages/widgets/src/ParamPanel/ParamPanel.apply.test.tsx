import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { APPLY_EVENT, ParamPanel } from './ParamPanel';

const KD = { key: 'kd', label: 'Kd', unit: '', min: 0, max: 1, step: 0.1, value: 0 };

describe('ParamPanel «Aplicar» event (v1.5)', () => {
  test('applies the values whose key it has, clamped to the range, and ignores the others', () => {
    const onChange = vi.fn();
    render(<ParamPanel params={[KD]} onChange={onChange} />);
    document.dispatchEvent(new CustomEvent(APPLY_EVENT, { detail: { kd: 5, other: 1 } }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('kd', 1);
  });
});

describe('ParamPanel «Más controles» (v1.5)', () => {
  const ALPHA = { ...KD, key: 'alpha', label: 'Alpha' };

  test('the folded sliders sit behind «Más controles», inside the same card', () => {
    render(<ParamPanel params={[KD]} folded={[ALPHA]} onChange={vi.fn()} />);
    expect(screen.getByText('Más controles')).toBeInTheDocument();
    const more = screen.getByTestId('params-more');
    expect(within(more).getByRole('slider', { name: /^Alpha/ })).toBeInTheDocument();
    expect(within(more).queryByRole('slider', { name: /^Kd/ })).toBeNull();
  });

  test('«Aplicar» also reaches a folded slider', () => {
    const onChange = vi.fn();
    render(<ParamPanel params={[KD]} folded={[ALPHA]} onChange={onChange} />);
    document.dispatchEvent(new CustomEvent(APPLY_EVENT, { detail: { alpha: 0.5 } }));
    expect(onChange).toHaveBeenCalledWith('alpha', 0.5);
  });

  test('without folded sliders there is no «Más controles»; a disabled one keeps its value', () => {
    render(<ParamPanel params={[{ ...KD, value: 0.4, disabled: true }]} onChange={vi.fn()} />);
    expect(screen.queryByText('Más controles')).toBeNull();
    expect(screen.getByRole('slider')).toBeDisabled();
    expect(screen.getByRole('slider')).toHaveValue('0.4');
  });
});
