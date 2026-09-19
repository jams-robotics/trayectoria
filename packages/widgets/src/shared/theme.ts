/**
 * Chart colours read from the CSS tokens at runtime (docs/DESIGN.md §2.2, §5, §7).
 * uPlot paints on a canvas, so it cannot inherit `var(--…)`: the values are resolved here and
 * re-resolved whenever `data-theme` changes on `<html>`.
 */
export interface PlotTheme {
  /** Element the tokens were read from; a token outside the data palette resolves against it. */
  element: Element | null;
  axis: string;
  grid: string;
  label: string;
  /** Series palette, `--color-data-1` first. */
  data: readonly string[];
}

/**
 * Fixed assignment of the data palette (docs/DESIGN.md §2.2), token name to its light value.
 * The light value doubles as the fallback where no stylesheet is attached (jsdom, or a chart
 * built before the first paint).
 */
const DATA_PALETTE: Readonly<Record<string, string>> = {
  '--color-data-1': '#0072b2',
  '--color-data-2': '#d55e00',
  '--color-data-3': '#009e73',
  '--color-data-4': '#b8578f',
  '--color-data-5': '#2d8fc4',
  '--color-data-6': '#6a5acd',
};

/** Token names of the data palette, in the order series take them. */
export const DATA_TOKENS: readonly string[] = Object.keys(DATA_PALETTE);

/**
 * Redundant stroke per series position (docs/DESIGN.md §2.2): series 1 solid, 2 dashed (8-4),
 * 3 dotted (2-3), 4 dash-dot. Beyond the fourth the cycle repeats.
 */
export const SERIES_DASHES: readonly (number[] | undefined)[] = [
  undefined,
  [8, 4],
  [2, 3],
  [8, 4, 2, 4],
];

/** Fallbacks used when no stylesheet is attached (jsdom, or a canvas rendered before paint). */
const FALLBACK = {
  axis: '#9fb0c0',
  grid: '#e4eaef',
  label: '#526475',
};

/** Resolves one token against an element; empty values fall back to `fallback`. */
function token(style: CSSStyleDeclaration | null, name: string, fallback: string): string {
  const value = style?.getPropertyValue(name).trim() ?? '';
  return value === '' ? fallback : value;
}

/** Computed style of `element`, or null when there is no stylesheet to read from. */
function styleOf(element: Element | null): CSSStyleDeclaration | null {
  if (element === null || typeof getComputedStyle !== 'function') return null;
  return getComputedStyle(element);
}

/** Reads the current values of the chart tokens from `element` (docs/DESIGN.md §5). */
export function readTheme(element: Element | null): PlotTheme {
  const style = styleOf(element);
  return {
    element,
    axis: token(style, '--sim-axis', FALLBACK.axis),
    grid: token(style, '--sim-grid', FALLBACK.grid),
    label: token(style, '--color-fg-muted', FALLBACK.label),
    data: DATA_TOKENS.map((name) => token(style, name, DATA_PALETTE[name] ?? FALLBACK.label)),
  };
}

/** True when the two themes resolve to the same colours (avoids rebuilding the chart). */
export function sameTheme(a: PlotTheme, b: PlotTheme): boolean {
  return (
    a.axis === b.axis &&
    a.grid === b.grid &&
    a.label === b.label &&
    a.data.every((color, index) => color === b.data[index])
  );
}

/**
 * Colour of a series: the token named by `color` when given, otherwise `--color-data-N` by
 * position (decision 7 of the assignment of #83; `color` is a token name, never a literal).
 * A token outside the data palette is resolved against the same element the theme came from.
 */
export function seriesColor(theme: PlotTheme, color: string | undefined, index: number): string {
  const byPosition = theme.data[index % theme.data.length] ?? FALLBACK.label;
  if (color === undefined) return byPosition;
  const known = DATA_TOKENS.indexOf(color);
  if (known >= 0) return theme.data[known] ?? byPosition;
  return token(styleOf(theme.element), color, byPosition);
}

/**
 * Fallbacks for the tokens `Scene2D` paints with (docs/DESIGN.md §2, §6), token name to its
 * light value. Used where no stylesheet is attached (jsdom, or a canvas drawn before paint);
 * the real value always comes from `getComputedStyle` at draw time.
 */
const SCENE_FALLBACKS: Readonly<Record<string, string>> = {
  ...DATA_PALETTE,
  '--color-bg-raised': '#ffffff',
  '--color-fg': '#1a242f',
  '--color-fg-muted': '#526475',
  '--color-border': '#d5dde5',
  '--color-error': '#bf3a2b',
  '--color-success': '#1c7a4e',
  '--color-vector-velocity': '#a85a05',
  '--color-vector-force': '#7b3fb8',
  '--sim-grid': '#e4eaef',
  '--sim-axis': '#9fb0c0',
  '--sim-track': '#2a3540',
  '--sim-robot': '#a25607',
  '--sim-sensor-on': '#1c7a4e',
  '--sim-sensor-off': '#b7c2cc',
  '--sim-trace': '#0072b2',
};

/**
 * Resolves a palette token by name against `element` (#84, decision 3 of the assignment).
 * `name` is a CSS custom property name with or without the leading `--`; a literal colour is
 * never accepted, so an unknown name falls back to the muted foreground rather than painting
 * something outside the palette (docs/DESIGN.md §7: ningún hex en componentes).
 */
export function tokenColor(element: Element | null, name: string): string {
  const property = name.startsWith('--') ? name : `--${name}`;
  const fallback = SCENE_FALLBACKS[property] ?? SCENE_FALLBACKS['--color-fg-muted'] ?? '';
  return token(styleOf(element), property, fallback);
}
