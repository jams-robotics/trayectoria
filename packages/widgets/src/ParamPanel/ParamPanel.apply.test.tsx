import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
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
