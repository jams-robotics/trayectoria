import { describe, expect, it } from 'vitest';

import { hintFor } from './hints';

describe('hintFor (v1.5)', () => {
  it('spots the opposite sign', () => {
    expect(hintFor(4, -4).key).toBe('hintSign');
  });

  it('spots the unit factors in both directions', () => {
    expect(hintFor(2, 120)).toEqual({ key: 'hintBig', factor: '60' });
    expect(hintFor(2, 2 / 1000)).toEqual({ key: 'hintSmall', factor: '1000' });
    expect(hintFor(1, 2 * Math.PI)).toEqual({ key: 'hintBig', factor: '2π' });
  });

  it('spots an order of magnitude and falls back to the generic hint', () => {
    expect(hintFor(1, 37).key).toBe('hintOrderBig');
    expect(hintFor(1, 0.03).key).toBe('hintOrderSmall');
    expect(hintFor(1, 1.4).key).toBe('hint');
    expect(hintFor(0, 3).key).toBe('hint');
  });
});
