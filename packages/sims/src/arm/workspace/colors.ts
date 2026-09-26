import { armToken } from '../armColors';

// F5-03 (#136, decision 3): the cloud is coloured by distance to the base, interpolating in RGB between
// `--color-data-1` and `--color-data-3` (docs/DESIGN.md §2.2). The tokens are read at
// runtime, as in `armColors.ts`, because three parses a colour and never a `var(--…)`.
// The ticket criterion requires distances and colours to be computed here, not in a shader.

/** Tokens of the ends of the ramp: near the base and far from it. */
export const WORKSPACE_TOKENS = {
  near: '--color-data-1',
  far: '--color-data-3',
} as const;

/** The two colours of the ramp, already resolved to something that can be parsed. */
export interface WorkspacePalette {
  /** Colour at distance 0. */
  readonly near: string;
  /** Colour at the maximum distance. */
  readonly far: string;
}

/** A colour in `[0, 1]` components, as the geometry's `color` attribute expects it. */
export type Rgb = readonly [number, number, number];

/** Components of an 8-bit channel. */
const CHANNEL_MAX = 255;

/** Parses `#rgb`, `#rrggbb` or `rgb(r, g, b)` into components in `[0, 1]`; black if not recognised. */
function parseColor(value: string): Rgb {
  const text = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex !== null) {
    const digits = hex[1] ?? '';
    const full = digits.length === 3 ? [...digits].map((d) => `${d}${d}`).join('') : digits;
    const channel = (start: number): number =>
      parseInt(full.slice(start, start + 2), 16) / CHANNEL_MAX;
    return [channel(0), channel(2), channel(4)];
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(text);
  if (rgb !== null) {
    const parts = (rgb[1] ?? '').split(/[,\s/]+/).filter((part) => part !== '');
    const channel = (index: number): number => (Number(parts[index] ?? 0) || 0) / CHANNEL_MAX;
    return [channel(0), channel(1), channel(2)];
  }
  return [0, 0, 0];
}

/**
 * Light values of the two tokens (docs/DESIGN.md §2.2); fallback for jsdom and for any
 * point with no stylesheet to query, like the `FALLBACK` of `armColors.ts`.
 */
const FALLBACK: WorkspacePalette = { near: '#0072b2', far: '#009e73' };

/** The ramp read from the document tokens; the light values if there is no stylesheet. */
export function readWorkspacePalette(element: Element | null): WorkspacePalette {
  const near = armToken(element, WORKSPACE_TOKENS.near);
  const far = armToken(element, WORKSPACE_TOKENS.far);
  return {
    near: near === '' ? FALLBACK.near : near,
    far: far === '' ? FALLBACK.far : far,
  };
}

/**
 * Distance from the base (the origin of the arm's base link) to each point of the flattened
 * cloud `[x0, y0, z0, …]`, in metres.
 */
export function distanceToBase_m(points: Float32Array): Float32Array {
  const distances = new Float32Array(points.length / 3);
  for (let i = 0; i < distances.length; i += 1) {
    distances[i] = Math.hypot(points[3 * i] ?? 0, points[3 * i + 1] ?? 0, points[3 * i + 2] ?? 0);
  }
  return distances;
}

/**
 * Colour of a point at distance `d_m` from the base, interpolating in RGB between the palette
 * ends. `d_m` is clamped to `[0, dMax_m]`; a zero `dMax_m` maps everything to the near end.
 */
export function colorFor(d_m: number, dMax_m: number, palette: WorkspacePalette): Rgb {
  const near = parseColor(palette.near);
  const far = parseColor(palette.far);
  const ratio = dMax_m <= 0 ? 0 : Math.min(Math.max(d_m / dMax_m, 0), 1);
  const mix = (from: number, to: number): number => from + (to - from) * ratio;
  return [mix(near[0], far[0]), mix(near[1], far[1]), mix(near[2], far[2])];
}

/**
 * Per-point colours of the whole cloud, flattened as `[r0, g0, b0, …]` for the geometry's
 * `color` attribute. The ramp spans from the base to the farthest sampled point.
 */
export function pointColors(points: Float32Array, palette: WorkspacePalette): Float32Array {
  const distances = distanceToBase_m(points);
  const colors = new Float32Array(points.length);
  let dMax_m = 0;
  for (const distance_m of distances) dMax_m = Math.max(dMax_m, distance_m);
  for (let i = 0; i < distances.length; i += 1) {
    const [r, g, b] = colorFor(distances[i] ?? 0, dMax_m, palette);
    colors[3 * i] = r;
    colors[3 * i + 1] = g;
    colors[3 * i + 2] = b;
  }
  return colors;
}
