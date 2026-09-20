import { describe, expect, it, vi } from 'vitest';

import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  cryptoRng,
  inviteCode,
  type Rng,
} from './inviteCode';

/** Cycles through the given draws, like the golden RNG of the ticket. */
function cyclingRng(draws: readonly number[]): Rng {
  let index = 0;
  return () => {
    const draw = draws[index % draws.length] ?? 0;
    index += 1;
    return draw;
  };
}

describe('inviteCode (F3-02a)', () => {
  it('maps the golden draws 0, 0.5 and 0.999… to A, S and 9', () => {
    const code = inviteCode(cyclingRng([0, 0.5, 0.9999999]));

    // Alphabet indices 0, 16 and 31 of ABCDEFGHJKLMNPQRSTUVWXYZ23456789.
    expect(code.slice(0, 3)).toBe('AS9');
    expect(code).toBe('AS9AS9AS');
  });

  it('returns 8 characters of the alphabet', () => {
    const code = inviteCode(cyclingRng([0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.97]));

    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(code).toBe(code.toUpperCase());
  });

  it('never leaves the alphabet for any draw in [0, 1)', () => {
    for (let step = 0; step < 100; step += 1) {
      const code = inviteCode(cyclingRng([step / 100]));
      for (const character of code) {
        expect(INVITE_CODE_ALPHABET).toContain(character);
      }
    }
  });

  it('clamps a draw at or beyond 1 to the last character', () => {
    expect(inviteCode(cyclingRng([1]))).toBe('99999999');
  });

  it('clamps a negative draw to the first character', () => {
    expect(inviteCode(cyclingRng([-0.5]))).toBe('AAAAAAAA');
  });

  it('draws from crypto.getRandomValues by default', () => {
    const spy = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint32Array) array[0] = 0;
        return array;
      });

    expect(inviteCode()).toBe('AAAAAAAA');
    expect(spy).toHaveBeenCalledTimes(INVITE_CODE_LENGTH);
    spy.mockRestore();
  });

  it('turns a 32-bit draw into a number in [0, 1)', () => {
    const spy = vi
      .spyOn(globalThis.crypto, 'getRandomValues')
      .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint32Array) array[0] = 0xffffffff;
        return array;
      });

    const draw = cryptoRng();

    expect(draw).toBeGreaterThan(0.99);
    expect(draw).toBeLessThan(1);
    spy.mockRestore();
  });
});
