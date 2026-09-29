/**
 * Closed forms of `MotorCurveWidget` (docs/WIDGETS.md, MotorCurveWidget; docs/GLOSSARY.md,
 * «Motor»): the torque–speed line `τ(ω) = τ_s (1 − ω/ω₀)`, the power parabola `P = τ ω`, the
 * current `I = I₀ + (I_s − I₀) τ/τ_s` and the efficiency `η_motor = P/(V I)`. No simulation in
 * time: everything is evaluated at the working point. The rpm ↔ rad/s conversions come from
 * `sim-core`, the only place a magnitude changes units (docs/STANDARDS.md §3).
 */
import { rpmToRadps } from '@trayectoria/sim-core';

/** The two numbers that fix the torque–speed line (docs/WIDGETS.md, MotorCurveWidget). */
export interface Motor {
  stallTorque_Nm: number;
  noLoadSpeed_rpm: number;
}

/** The currents and the supply; only with the three does the panel show `I` and `η_motor`. */
export interface MotorElectrical {
  noLoadCurrent_A: number;
  stallCurrent_A: number;
  voltage_V: number;
}

/** The sampled curves the two charts draw, aligned on the same speeds from 0 to `n₀`. */
export interface MotorCurves {
  speed_rpm: readonly number[];
  torque_Nm: readonly number[];
  power_W: readonly number[];
}

/** Samples per curve: an odd count, so the middle one lands exactly on `n₀/2` (`P_max`). */
export const CURVE_SAMPLES = 101;

/** Keeps a speed on the line: the motor only works between stall and no load. */
export function clampSpeed_rpm(motor: Motor, speed_rpm: number): number {
  return Math.min(Math.max(speed_rpm, 0), motor.noLoadSpeed_rpm);
}

/** Working point when the topic sets none: `n₀/2`, the maximum power point (WIDGETS.md). */
export function defaultSpeed_rpm(motor: Motor): number {
  return motor.noLoadSpeed_rpm / 2;
}

/** Torque at a speed, `τ = τ_s (1 − n/n₀)`, in N·m (GLOSSARY.md, «Motor»). */
export function torqueAt_Nm(motor: Motor, speed_rpm: number): number {
  if (motor.noLoadSpeed_rpm === 0) return 0;
  return motor.stallTorque_Nm * (1 - speed_rpm / motor.noLoadSpeed_rpm);
}

/** Mechanical power at a speed, `P = τ ω`, in watts. */
export function powerAt_W(motor: Motor, speed_rpm: number): number {
  return torqueAt_Nm(motor, speed_rpm) * rpmToRadps(speed_rpm);
}

/** Current at a speed, `I = I₀ + (I_s − I₀) τ/τ_s`, in amperes. */
export function currentAt_A(motor: Motor, electrical: MotorElectrical, speed_rpm: number): number {
  const share =
    motor.stallTorque_Nm === 0 ? 0 : torqueAt_Nm(motor, speed_rpm) / motor.stallTorque_Nm;
  return (
    electrical.noLoadCurrent_A + (electrical.stallCurrent_A - electrical.noLoadCurrent_A) * share
  );
}

/** Electrical power drawn at a speed, `P_el = V I`, in watts. */
export function electricalPowerAt_W(
  motor: Motor,
  electrical: MotorElectrical,
  speed_rpm: number,
): number {
  return electrical.voltage_V * currentAt_A(motor, electrical, speed_rpm);
}

/** Motor efficiency at a speed, `η_motor = P / (V I)`; zero when nothing is drawn. */
export function motorEfficiency(
  motor: Motor,
  electrical: MotorElectrical,
  speed_rpm: number,
): number {
  const electricalPower_W = electricalPowerAt_W(motor, electrical, speed_rpm);
  if (electricalPower_W === 0) return 0;
  return powerAt_W(motor, speed_rpm) / electricalPower_W;
}

/** Maximum mechanical power, `P_max = τ_s ω₀ / 4`, in watts (GLOSSARY.md, «Motor»). */
export function maxPower_W(motor: Motor): number {
  return (motor.stallTorque_Nm * rpmToRadps(motor.noLoadSpeed_rpm)) / 4;
}

/** Speed of the maximum power, `n₀/2`, in rpm. */
export function maxPowerSpeed_rpm(motor: Motor): number {
  return motor.noLoadSpeed_rpm / 2;
}

/** The torque line and the power parabola sampled on `samples` speeds from 0 to `n₀`. */
export function sampleCurves(motor: Motor, samples: number = CURVE_SAMPLES): MotorCurves {
  const last = samples - 1;
  const speed_rpm = Array.from({ length: samples }, (_, index) =>
    last === 0 ? 0 : (motor.noLoadSpeed_rpm * index) / last,
  );
  return {
    speed_rpm,
    torque_Nm: speed_rpm.map((n_rpm) => torqueAt_Nm(motor, n_rpm)),
    power_W: speed_rpm.map((n_rpm) => powerAt_W(motor, n_rpm)),
  };
}

/**
 * The electrical model of the `initial` props, only when the two currents and the voltage are
 * all given; otherwise the current, electrical power and efficiency rows do not exist (#611).
 */
export function electricalOf(initial: {
  noLoadCurrent_A?: number;
  stallCurrent_A?: number;
  voltage_V?: number;
}): MotorElectrical | undefined {
  const { noLoadCurrent_A, stallCurrent_A, voltage_V } = initial;
  if (noLoadCurrent_A === undefined || stallCurrent_A === undefined || voltage_V === undefined) {
    return undefined;
  }
  return { noLoadCurrent_A, stallCurrent_A, voltage_V };
}
