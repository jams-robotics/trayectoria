import type { Axis } from '../../lib/aula/classChannel';

/** Below this fraction of the radius the knob counts as centred: a resting thumb does not drive. */
export const DEAD_ZONE = 0.3;

/**
 * The drive of a knob moved `dx`, `dy` pixels from the centre of a pad of radius `radius_px`
 * (screen axes: `dy` grows downwards). Up drives forward and left turns left (`steer` +1), as
 * the keyboard does.
 */
export function axesOf(dx: number, dy: number, radius_px: number): { steer: Axis; go: Axis } {
  const limit = radius_px * DEAD_ZONE;
  const axis = (value: number): Axis => (value > limit ? 1 : value < -limit ? -1 : 0);
  return { steer: axis(-dx), go: axis(-dy) };
}

/** The knob's offset, clamped to the pad so it never leaves the ring. */
export function clampToPad(dx: number, dy: number, radius_px: number): { x: number; y: number } {
  const length = Math.hypot(dx, dy);
  if (length <= radius_px) return { x: dx, y: dy };
  return { x: (dx / length) * radius_px, y: (dy / length) * radius_px };
}
