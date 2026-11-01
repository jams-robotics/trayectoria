import { Color } from 'three';

// Every colour of the arena comes from the tokens of docs/DESIGN.md, read from the arena's root
// element. The root carries `data-theme="dark"`, so the scene is always the dark palette: the
// arena is deliberately a dark stage in both themes, like a sim viewer lit from above.

export interface ArenaPalette {
  readonly floor: Color;
  readonly grid: Color;
  readonly mat: Color;
  readonly line: Color;
  readonly robot: Color;
  readonly ghost: Color;
  readonly wheel: Color;
  readonly deck: Color;
  readonly board: Color;
  readonly sensorOn: Color;
  readonly sensorOff: Color;
  readonly good: Color;
  readonly warn: Color;
  readonly bad: Color;
  readonly accent: Color;
}

function read(root: Element, name: string): Color {
  const value = getComputedStyle(root).getPropertyValue(name).trim();
  // shortcut: an unresolved token paints grey instead of throwing; only happens without the CSS.
  return new Color(value === '' ? 'gray' : value);
}

export function readPalette(root: Element): ArenaPalette {
  return {
    floor: read(root, '--color-bg'),
    grid: read(root, '--sim-grid'),
    mat: read(root, '--sim-track'),
    line: read(root, '--color-bg'),
    robot: read(root, '--sim-robot'),
    ghost: read(root, '--color-primary'),
    wheel: read(root, '--color-bg-raised'),
    deck: read(root, '--color-border'),
    board: read(root, '--color-data-1'),
    sensorOn: read(root, '--sim-sensor-on'),
    sensorOff: read(root, '--sim-sensor-off'),
    good: read(root, '--color-success'),
    warn: read(root, '--color-warning'),
    bad: read(root, '--color-error'),
    accent: read(root, '--color-primary'),
  };
}

/** Colour of a line error in `[0, 1]`: green centred, amber halfway, red at the edge. */
export function errorColor(palette: ArenaPalette, error: number, out: Color): Color {
  const e = Math.min(Math.max(error, 0), 1);
  if (e < 0.5) return out.copy(palette.good).lerp(palette.warn, e * 2);
  return out.copy(palette.warn).lerp(palette.bad, (e - 0.5) * 2);
}
