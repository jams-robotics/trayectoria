import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYWRIGHT_PORT, resolvePlaywrightPort } from './playwrightPort';

describe('resolvePlaywrightPort', () => {
  it('defaults to 4321 when PLAYWRIGHT_PORT is not set', () => {
    expect(DEFAULT_PLAYWRIGHT_PORT).toBe(4321);
    expect(resolvePlaywrightPort(undefined)).toBe(4321);
    expect(resolvePlaywrightPort('')).toBe(4321);
  });

  it('reads an integer port between 1024 and 65535', () => {
    expect(resolvePlaywrightPort('4399')).toBe(4399);
    expect(resolvePlaywrightPort('1024')).toBe(1024);
    expect(resolvePlaywrightPort('65535')).toBe(65535);
  });

  it.each(['abc', '43.5', '1023', '65536', '0', '-4321', '4321abc', ' 4399'])(
    'rejects %j with a clear error',
    (value) => {
      expect(() => resolvePlaywrightPort(value)).toThrow(
        `PLAYWRIGHT_PORT must be an integer between 1024 and 65535, got "${value}"`,
      );
    },
  );
});
