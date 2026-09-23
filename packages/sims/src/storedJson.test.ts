import { describe, expect, it } from 'vitest';

import { MAX_STORED_JSON_BYTES, fitsStoredJson } from './storedJson';

// #210 (decisions 2 and 5): the bound of the `jsonb` columns the client writes, measured as the
// UTF-8 bytes of the `JSON.stringify` text. A string value adds its two quotes to the text, so
// `'a'.repeat(n)` is `n + 2` bytes.

describe('fitsStoredJson (#210)', () => {
  it('is 64 KiB', () => {
    expect(MAX_STORED_JSON_BYTES).toBe(65_536);
  });

  it('accepts 65 535 bytes and rejects 65 536', () => {
    expect(fitsStoredJson('a'.repeat(65_533))).toBe(true);
    expect(fitsStoredJson('a'.repeat(65_534))).toBe(false);
  });

  it('counts the UTF-8 bytes of multibyte characters, not UTF-16 code units', () => {
    // «ñ» is 2 bytes: 32 766 × 2 + 1 + 2 quotes = 65 535; 32 767 × 2 + 2 quotes = 65 536.
    expect(fitsStoredJson('ñ'.repeat(32_766) + 'a')).toBe(true);
    expect(fitsStoredJson('ñ'.repeat(32_767))).toBe(false);
    // «€» is 3 bytes and 1 code unit: 21 844 × 3 + 1 + 2 = 65 535; one more «a» is 65 536.
    expect(fitsStoredJson('€'.repeat(21_844) + 'a')).toBe(true);
    expect(fitsStoredJson('€'.repeat(21_844) + 'aa')).toBe(false);
    // «🤖» is 4 bytes and 2 code units: 16 383 × 4 + 1 + 2 = 65 535.
    expect(fitsStoredJson('🤖'.repeat(16_383) + 'a')).toBe(true);
    expect(fitsStoredJson('🤖'.repeat(16_383) + 'aa')).toBe(false);
  });

  it('measures objects by their JSON text', () => {
    // `{"k":"…"}` adds 8 bytes around the string content.
    expect(fitsStoredJson({ k: 'a'.repeat(65_527) })).toBe(true);
    expect(fitsStoredJson({ k: 'a'.repeat(65_528) })).toBe(false);
    expect(fitsStoredJson({ segments: [], lineWidth_m: 0.02 })).toBe(true);
  });
});
