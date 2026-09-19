import { afterEach, describe, expect, it } from 'vitest';

import { DATA_TOKENS, readTheme, sameTheme, seriesColor, tokenColor } from './theme';

/** Attaches a stylesheet with the chart tokens and returns the element to read them from. */
function withTokens(css: string): HTMLElement {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  const host = document.createElement('div');
  document.body.append(host);
  return host;
}

afterEach(() => {
  document.head.querySelectorAll('style').forEach((node) => {
    node.remove();
  });
  document.body.replaceChildren();
});

describe('readTheme', () => {
  it('resolves the chart tokens of docs/DESIGN.md §2.2 and §5', () => {
    const host = withTokens(`
      :root { --sim-axis: #9fb0c0; --sim-grid: #e4eaef; --color-fg-muted: #526475;
              --color-data-1: #0072b2; --color-data-2: #d55e00; }
    `);

    const theme = readTheme(host);
    expect(theme.axis).toBe('#9fb0c0');
    expect(theme.grid).toBe('#e4eaef');
    expect(theme.label).toBe('#526475');
    expect(theme.data[0]).toBe('#0072b2');
    expect(theme.data[1]).toBe('#d55e00');
    expect(theme.data).toHaveLength(DATA_TOKENS.length);
  });

  it('falls back to the light values when no stylesheet is attached', () => {
    const theme = readTheme(null);

    expect(theme.element).toBeNull();
    expect(theme.axis).toBe('#9fb0c0');
    expect(theme.data[0]).toBe('#0072b2');
  });
});

describe('sameTheme', () => {
  it('is true for two reads of the same tokens and false after a change', () => {
    const host = withTokens(':root { --sim-axis: #9fb0c0; --color-data-1: #0072b2; }');
    const first = readTheme(host);
    expect(sameTheme(first, readTheme(host))).toBe(true);

    document.head.querySelectorAll('style').forEach((node) => {
      node.remove();
    });
    withTokens(':root { --sim-axis: #4b5b6c; --color-data-1: #5aa9e6; }');
    expect(sameTheme(first, readTheme(host))).toBe(false);
  });

  it('separates a change in each field', () => {
    const base = readTheme(null);
    expect(sameTheme(base, { ...base, grid: '#000' })).toBe(false);
    expect(sameTheme(base, { ...base, label: '#000' })).toBe(false);
  });
});

describe('seriesColor', () => {
  it('assigns --color-data-N by position when the series has no colour', () => {
    const theme = readTheme(null);

    expect(seriesColor(theme, undefined, 0)).toBe(theme.data[0]);
    expect(seriesColor(theme, undefined, 2)).toBe(theme.data[2]);
    // Past the sixth series the palette cycles rather than running out.
    expect(seriesColor(theme, undefined, 6)).toBe(theme.data[0]);
  });

  it('honours a token of the data palette given by name', () => {
    const theme = readTheme(null);

    expect(seriesColor(theme, '--color-data-3', 0)).toBe(theme.data[2]);
  });

  it('resolves a token outside the data palette against the element it read', () => {
    const host = withTokens(':root { --color-vector-velocity: #a85a05; }');
    const theme = readTheme(host);

    expect(seriesColor(theme, '--color-vector-velocity', 0)).toBe('#a85a05');
    // An undefined token falls back to the palette slot, never to a literal.
    expect(seriesColor(theme, '--color-missing', 1)).toBe(theme.data[1]);
  });
});

describe('tokenColor (Scene2D primitives, #84)', () => {
  it('resolves a simulation token by name, with or without the leading dashes', () => {
    const host = withTokens(':root { --sim-trace: #0072b2; --sim-axis: #9fb0c0; }');

    expect(tokenColor(host, 'sim-trace')).toBe('#0072b2');
    expect(tokenColor(host, '--sim-axis')).toBe('#9fb0c0');
  });

  it('honours the theme in force, not the light value', () => {
    const host = withTokens(':root { --sim-grid: #222d39; }');

    expect(tokenColor(host, 'sim-grid')).toBe('#222d39');
  });

  it('falls back to the light value of the token where no stylesheet is attached', () => {
    expect(tokenColor(null, 'color-vector-velocity')).toBe('#a85a05');
    expect(tokenColor(null, 'sim-axis')).toBe('#9fb0c0');
  });

  it('never returns a colour outside the palette for an unknown token', () => {
    expect(tokenColor(null, 'color-does-not-exist')).toBe('#526475');
  });
});
