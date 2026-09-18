import { G_MPS2 } from './kinematics1d';

/**
 * Work, energy and power (CURRICULUM.md M3, topics 3.1 and 3.2). Potential energy is measured
 * from the height taken as the zero reference by the caller.
 */

/** Kinetic energy: `E_k = m v^2 / 2`. */
export function kineticEnergy_J(m_kg: number, v_mps: number): number {
  return 0.5 * m_kg * v_mps * v_mps;
}

/** Gravitational potential energy: `E_p = m g h`. */
export function potentialEnergy_J(m_kg: number, h_m: number): number {
  return m_kg * G_MPS2 * h_m;
}

/** Mechanical energy: `E = E_k + E_p`, constant when no friction acts. */
export function mechanicalEnergy_J(m_kg: number, v_mps: number, h_m: number): number {
  return kineticEnergy_J(m_kg, v_mps) + potentialEnergy_J(m_kg, h_m);
}

/** Average power: `P = W / t`. Throws when `t_s` is not positive. */
export function power_W(work_J: number, t_s: number): number {
  if (!(t_s > 0)) {
    throw new RangeError(`t_s must be > 0, got ${String(t_s)}`);
  }
  return work_J / t_s;
}
