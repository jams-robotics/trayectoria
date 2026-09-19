import { describe, expect, test } from 'vitest';

import { randomSeed, seedFor } from './seed';

describe('seedFor (F2-10)', () => {
  test('same user, topic, exercise and round give the same seed', () => {
    const first = seedFor('user-1', 'ruta-1/m01-t01', 'e1', 0);
    const second = seedFor('user-1', 'ruta-1/m01-t01', 'e1', 0);

    expect(first).toBe(second);
  });

  test('a new round gives a different seed for the same exercise', () => {
    const round0 = seedFor('user-1', 'ruta-1/m01-t01', 'e1', 0);
    const round1 = seedFor('user-1', 'ruta-1/m01-t01', 'e1', 1);

    expect(round1).not.toBe(round0);
  });

  test('a different user, topic or exercise gives a different seed', () => {
    const base = seedFor('user-1', 'ruta-1/m01-t01', 'e1', 0);

    expect(seedFor('user-2', 'ruta-1/m01-t01', 'e1', 0)).not.toBe(base);
    expect(seedFor('user-1', 'ruta-1/m01-t02', 'e1', 0)).not.toBe(base);
    expect(seedFor('user-1', 'ruta-1/m01-t01', 'e2', 0)).not.toBe(base);
  });

  test('is an unsigned 32-bit integer, usable straight as a `createRng` seed', () => {
    const seed = seedFor('user-1', 'ruta-1/m01-t01', 'e1', 3);

    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 32);
    expect(seed >>> 0).toBe(seed);
  });

  test('is the FNV-1a hash of `userId:topicId:exerciseId:round`', () => {
    // Hand-computed reference: FNV-1a 32 bits of "u:t:e:0" (offset 2166136261, prime 16777619).
    let expected = 2166136261;
    for (const character of 'u:t:e:0') {
      expected = Math.imul(expected ^ character.charCodeAt(0), 16777619);
    }

    expect(seedFor('u', 't', 'e', 0)).toBe(expected >>> 0);
  });
});

describe('randomSeed (F2-10)', () => {
  test('uses the injected source to build an unsigned 32-bit integer', () => {
    expect(randomSeed(() => 0)).toBe(0);
    expect(randomSeed(() => 0.5)).toBe(2 ** 31);
    // The source never returns 1, so the largest seed stays inside 32 bits.
    expect(randomSeed(() => 1 - Number.EPSILON / 2)).toBeLessThan(2 ** 32);
  });

  test('without a source draws from Math.random and stays in range', () => {
    for (let index = 0; index < 100; index += 1) {
      const seed = randomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 32);
    }
  });
});
