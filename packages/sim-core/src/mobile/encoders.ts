import type { MobileSpec } from '@trayectoria/robot-spec';

import type { DiffDriveState } from './diffDrive';

const TWO_PI = 2 * Math.PI;

/** Tick counts of both wheel encoders. */
export interface EncoderReading {
  readonly left: number;
  readonly right: number;
}

/**
 * Ticks accumulated by a wheel that has turned `wheelAngle_rad`
 * (`docs/ARCHITECTURE.md` §4.1: `floor(wheelAngle_rad / 2π · ticksPerRev)`). `Math.floor` also
 * applies to negative angles, so reversing one full turn from 0 reads `-ticksPerRev`.
 */
export function encoderTicks(wheelAngle_rad: number, ticksPerRev: number): number {
  return Math.floor((wheelAngle_rad / TWO_PI) * ticksPerRev);
}

/**
 * Reads both encoders from the accumulated wheel angles in `state`. When the spec declares no
 * `encoderTicksPerRev` the robot has no encoders and both counts are 0.
 */
export function readEncoders(state: DiffDriveState, spec: MobileSpec): EncoderReading {
  const ticksPerRev = spec.encoderTicksPerRev;
  if (ticksPerRev === undefined) return { left: 0, right: 0 };
  return {
    left: encoderTicks(state.wheelAngleL_rad, ticksPerRev),
    right: encoderTicks(state.wheelAngleR_rad, ticksPerRev),
  };
}
