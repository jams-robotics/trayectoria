import { describe, expect, it } from 'vitest';

import { rangeShare } from './ScaleBar';

describe('rangeShare (v1.5)', () => {
  it('es la parte del rango completo que recorren los datos visibles', () => {
    // A dip from 0.48 to 0.467 m/s on a 0..0.48 axis: 2.7 %.
    const data = [new Float64Array([0, 1, 2]), new Float64Array([0.48, 0.467, 0.48])];
    expect(rangeShare(data, [0, 0.48])).toBeCloseTo(0.013 / 0.48, 12);
  });

  it('sin datos no hay parte, y nunca pasa de 1', () => {
    expect(rangeShare([new Float64Array()], [0, 1])).toBeNull();
    const data = [new Float64Array([0, 1]), new Float64Array([-3, 3])];
    expect(rangeShare(data, [-1, 1])).toBe(1);
  });
});
