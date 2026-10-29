import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isInternalPath, rememberReturnTo, takeReturnTo } from './returnTo';

describe('returnTo', () => {
  beforeEach(() => {
    const items = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
      removeItem: (key: string) => items.delete(key),
    });
  });

  it('accepts internal paths and refuses anything that leaves the site', () => {
    expect(isInternalPath('/aula/sesion#t=abc')).toBe(true);
    for (const bad of ['//evil.test', '/\\evil.test', 'https://evil.test', 'javascript:1', '', '/a\nb'])
      expect(isInternalPath(bad)).toBe(false);
  });

  it('gives the path back once and then forgets it', () => {
    rememberReturnTo('/aula/sesion#t=abc');
    expect(takeReturnTo('/cuenta')).toBe('/aula/sesion#t=abc');
    expect(takeReturnTo('/cuenta')).toBe('/cuenta');
  });

  it('ignores an external destination', () => {
    rememberReturnTo('//evil.test');
    expect(takeReturnTo('/cuenta')).toBe('/cuenta');
  });
});
