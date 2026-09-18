import { degToRad, radToDeg } from './angles';

/**
 * Unit conversions. Per `docs/STANDARDS.md` §3 this file and the UI layer are the only places
 * where a magnitude changes units; everywhere else the unit suffix in the name is the contract.
 * The angle conversions live in `angles.ts` and are re-exported here for convenience.
 */
export { degToRad, radToDeg };

const RADPS_PER_RPM = (2 * Math.PI) / 60;
const MPS_PER_KMH = 1 / 3.6;

/** Revolutions per minute to radians per second. */
export function rpmToRadps(speed_rpm: number): number {
  return speed_rpm * RADPS_PER_RPM;
}

/** Radians per second to revolutions per minute. */
export function radpsToRpm(omega_radps: number): number {
  return omega_radps / RADPS_PER_RPM;
}

/** Kilometres per hour to metres per second. */
export function kmhToMps(speed_kmh: number): number {
  return speed_kmh * MPS_PER_KMH;
}

/** Metres per second to kilometres per hour. */
export function mpsToKmh(v_mps: number): number {
  return v_mps / MPS_PER_KMH;
}
