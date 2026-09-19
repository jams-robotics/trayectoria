import type { JSX } from 'react';
import { Html } from '@react-three/drei';

/**
 * Token of each axis of the triad (docs/DESIGN.md §6: «marco del efector en RGB (x error,
 * y success, z data-1)»). The order is X, Y, Z.
 */
export const AXIS_TOKENS: readonly [string, string, string] = [
  'color-error',
  'color-success',
  'color-data-1',
];

/**
 * Light value of each axis token, used only where no stylesheet is attached (jsdom, or a scene
 * built before the first paint). `shared/theme.ts` carries the fallbacks of the tokens Scene2D
 * paints with, and `--color-error` and `--color-success` are not among them; the real value
 * always comes from `getComputedStyle`, so the theme still drives the colours in the browser.
 */
const AXIS_FALLBACKS: readonly [string, string, string] = ['#bf3a2b', '#1c7a4e', '#0072b2'];

/** Resolves one axis token against `<html>`, falling back to its light value. */
function axisColor(element: Element | null, index: number): string {
  const name = `--${AXIS_TOKENS[index] ?? ''}`;
  const fallback = AXIS_FALLBACKS[index] ?? '';
  if (element === null || typeof getComputedStyle !== 'function') return fallback;
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  return value === '' ? fallback : value;
}

/** Unit direction of each axis of the triad, in the same order as `AXIS_TOKENS`. */
const AXIS_DIRECTIONS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

/** Radius of the cylinder that draws an arm of the triad, as a fraction of its length. */
const ARM_RADIUS_RATIO = 0.02;
/** Radial segments of the arms; enough to read as round at the sizes of the viewer. */
const ARM_SEGMENTS = 12;

export interface FrameProps {
  /** Origin of the triad in world coordinates, in metres. Defaults to the world origin. */
  position_m?: readonly [number, number, number];
  /** Length of each arm of the triad, in metres. */
  length_m?: number;
  /** Text shown next to the origin, already translated by the widget that uses it. */
  label?: string;
}

/** Default arm length of a triad, in metres (docs/DESIGN.md §6, arm viewer scale). */
const DEFAULT_LENGTH_M = 0.2;

/**
 * Rotation that takes the `+Y` axis of a cylinder — its own axis in three.js — onto `direction`,
 * as Euler angles in radians. Only the three unit axes are needed, so the rotations are exact.
 */
function armRotation_rad(direction: readonly [number, number, number]): [number, number, number] {
  const [x, , z] = direction;
  if (x === 1) return [0, 0, -Math.PI / 2];
  if (z === 1) return [Math.PI / 2, 0, 0];
  return [0, 0, 0];
}

/** One arm of the triad: a cylinder from the origin along `direction`, coloured by its token. */
function Arm({
  direction,
  length_m,
  color,
}: {
  direction: readonly [number, number, number];
  length_m: number;
  color: string;
}): JSX.Element {
  const half_m = length_m / 2;
  const radius_m = length_m * ARM_RADIUS_RATIO;
  return (
    <mesh
      position={[direction[0] * half_m, direction[1] * half_m, direction[2] * half_m]}
      rotation={armRotation_rad(direction)}
    >
      <cylinderGeometry args={[radius_m, radius_m, length_m, ARM_SEGMENTS]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/**
 * XYZ triad drawn at `position_m` (docs/WIDGETS.md, Scene3D: «`Frame` (tríada con etiqueta)»).
 * The three arms take the axis tokens of docs/DESIGN.md §6, resolved at runtime so they follow
 * the theme, and the optional label is rendered as DOM by drei's `Html`.
 */
export function Frame({
  position_m = [0, 0, 0],
  length_m = DEFAULT_LENGTH_M,
  label,
}: FrameProps): JSX.Element {
  const element = typeof document === 'undefined' ? null : document.documentElement;
  const colors = AXIS_TOKENS.map((_token, index) => axisColor(element, index));
  return (
    <group position={[position_m[0], position_m[1], position_m[2]]} data-testid="frame">
      {AXIS_DIRECTIONS.map((direction, index) => (
        <Arm
          key={AXIS_TOKENS[index]}
          direction={direction}
          length_m={length_m}
          color={colors[index] ?? ''}
        />
      ))}
      {label === undefined ? null : (
        <Html center position={[0, 0, -length_m / 2]}>
          <span className="text-fg-muted font-mono text-xs whitespace-nowrap">{label}</span>
        </Html>
      )}
    </group>
  );
}
