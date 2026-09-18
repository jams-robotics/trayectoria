import { describe, expect, test } from 'vitest';

import { createRng } from './SeededRng';

describe('F1-02 createRng (mulberry32)', () => {
  test('the same seed yields the same 1000-value sequence', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  test('different seeds yield different sequences', () => {
    const a = createRng(1);
    const b = createRng(2);
    const same = Array.from({ length: 10 }, () => a.next() === b.next());
    expect(same).toContain(false);
  });

  test('next() stays in [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 10_000; i++) {
      const u = rng.next();
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  test('matches the mulberry32 reference output for seed 0', () => {
    const rng = createRng(0);
    // First outputs of the canonical mulberry32(0) as 32-bit integers.
    expect(rng.next()).toBe(1144304738 / 4294967296);
    expect(rng.next()).toBe(1416247 / 4294967296);
    expect(rng.next()).toBe(958946056 / 4294967296);
  });

  test('non-integer and negative seeds are normalised to uint32 deterministically', () => {
    expect(createRng(-1).next()).toBe(createRng(4294967295).next());
    expect(createRng(1.9).next()).toBe(createRng(1).next());
  });

  test('nextInt(min, max) returns integers within [min, max] inclusive and hits both ends', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const n = rng.nextInt(-2, 3);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(-2);
      expect(n).toBeLessThanOrEqual(3);
      seen.add(n);
    }
    expect(seen.size).toBe(6);
  });

  test('nextInt(min, min) always returns min', () => {
    const rng = createRng(9);
    for (let i = 0; i < 10; i++) expect(rng.nextInt(5, 5)).toBe(5);
  });

  test('nextGaussian(mean, sigma) has the requested moments', () => {
    const rng = createRng(2026);
    const n = 20_000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const x = rng.nextGaussian(10, 2);
      sum += x;
      sumSq += x * x;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    expect(mean).toBeCloseTo(10, 1);
    expect(Math.sqrt(variance)).toBeCloseTo(2, 1);
  });

  test('nextGaussian is deterministic for the same seed', () => {
    const a = createRng(11);
    const b = createRng(11);
    for (let i = 0; i < 100; i++) expect(a.nextGaussian(0, 1)).toBe(b.nextGaussian(0, 1));
  });
});
