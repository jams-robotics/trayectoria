import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-3.3 (docs/CURRICULUM.md § T-3.3): the motor of «Mi robot» at its maximum
 * power point. (1) `P_max = τ_s ω₀ / 4`; (2) that point in the motor and in the wheel; (3) the
 * current there and the motor efficiency `η_motor = P_max / (V I)`; (4) the autonomy of two motors
 * at that current, next to the worst case of T-3.2 (stall current). The MDX renders them with
 * `<RobotFormula calc="ruta-1/m03-t03/max-power" />`, `…/max-power-point`,
 * `…/current-efficiency` and `…/autonomy`.
 */

const MOTORS = 2;
const MIN_PER_H = 60;
const RPM_TO_RADPS = (2 * Math.PI) / 60;

/**
 * Reference robot (docs/ROBOT-SPEC.md §3: τ_s = 0.012 N·m, n₀ = 6000 rpm, 6 V, η_caja = 0.6,
 * I₀ = 0.1 A, I_s = 1.2 A, i = 30, r = 0.032 m, 11.1 Wh). `content` takes robot-spec for its
 * types only (#246), so the numbers are here.
 */
const REFERENCE_MOTOR = { stallTorque_Nm: 0.012, voltage_V: 6, gearboxEfficiency: 0.6 } as const;
const REFERENCE_CURRENTS = { noLoadCurrent_A: 0.1, stallCurrent_A: 1.2 } as const;
const REFERENCE_DRIVE = { noLoadSpeed_rpm: 6000, gearRatio: 30, wheelRadius_m: 0.032 } as const;
const REFERENCE_BATTERY_WH = 11.1;

interface Drive {
  readonly stallTorque_Nm: number;
  readonly noLoadSpeed_rpm: number;
  readonly voltage_V: number;
  readonly noLoadCurrent_A: number;
  readonly stallCurrent_A: number;
  readonly gearboxEfficiency: number;
  readonly gearRatio: number;
  readonly wheelRadius_m: number;
  readonly batteryCapacity_Wh: number;
}

/**
 * Motor, currents, reduction, wheel and battery of the profile. `motor`, its two currents and
 * `battery` are optional in RobotSpec: a missing one takes the reference value (the two currents
 * as a pair, since `I_s` must exceed `I₀`); an arm profile has no wheels and takes the whole
 * reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function drive(robot: RobotSpec): Drive {
  const { mobile } = robot;
  if (mobile === undefined) {
    return {
      ...REFERENCE_MOTOR,
      ...REFERENCE_CURRENTS,
      ...REFERENCE_DRIVE,
      batteryCapacity_Wh: REFERENCE_BATTERY_WH,
    };
  }
  const { motor } = mobile;
  const currents =
    motor?.noLoadCurrent_A === undefined || motor.stallCurrent_A === undefined
      ? REFERENCE_CURRENTS
      : { noLoadCurrent_A: motor.noLoadCurrent_A, stallCurrent_A: motor.stallCurrent_A };
  return {
    ...(motor === undefined
      ? REFERENCE_MOTOR
      : {
          stallTorque_Nm: motor.stallTorque_Nm,
          voltage_V: motor.nominalVoltage_V,
          gearboxEfficiency: motor.efficiency,
        }),
    ...currents,
    noLoadSpeed_rpm: mobile.maxMotorSpeed_rpm,
    gearRatio: mobile.gearRatio,
    wheelRadius_m: mobile.wheelRadius_m,
    batteryCapacity_Wh: mobile.battery?.capacity_Wh ?? REFERENCE_BATTERY_WH,
  };
}

/** `ω₀ = n₀·2π/60`. */
function noLoadSpeed_radps({ noLoadSpeed_rpm }: Drive): number {
  return noLoadSpeed_rpm * RPM_TO_RADPS;
}

/** `P_max = τ_s ω₀ / 4`. */
function maxPower_W(motorData: Drive): number {
  return (motorData.stallTorque_Nm * noLoadSpeed_radps(motorData)) / 4;
}

/** Current at the maximum power point, where `τ = τ_s/2`: `I = I₀ + (I_s − I₀)/2`. */
function currentAtMaxPower_A({ noLoadCurrent_A, stallCurrent_A }: Drive): number {
  return noLoadCurrent_A + (stallCurrent_A - noLoadCurrent_A) / 2;
}

/**
 * The rounding of the spec's golden values: one decimal from 10 up (628.3 rad/s, 85.4 min),
 * three significant figures below (0.335 m/s, 0.483) and four when the first digit is 1
 * (1.885 W, 1.423 h, 0.108 N·m). Trailing zeros are dropped (0.65 A, 7.8 W).
 */
function format(value: number): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 10) return String(Number(value.toFixed(1)));
  const leadingDigit = Math.floor(magnitude / 10 ** Math.floor(Math.log10(magnitude)));
  return String(Number(value.toPrecision(leadingDigit === 1 ? 4 : 3)));
}

const NM = String.raw`\ \text{N}\cdot\text{m}`;
const RPM = String.raw`\ \text{rpm}`;
const RADPS = String.raw`\ \text{rad/s}`;
const W = String.raw`\ \text{W}`;
const V = String.raw`\ \text{V}`;
const A = String.raw`\ \text{A}`;

function aligned(...lines: readonly string[]): string {
  return String.raw`\begin{aligned} ${lines.join(String.raw` \\ `)} \end{aligned}`;
}

/** (1) `P_max = τ_s ω₀ / 4`, with `ω₀ = n₀·2π/60`. */
export const maxPower: RobotCalc = {
  id: 'max-power',
  compute(robot) {
    const motorData = drive(robot);
    const omega0 = format(noLoadSpeed_radps(motorData));
    return {
      latex: String.raw`P_{max} = \dfrac{\tau_s\,\omega_0}{4}`,
      substituted: aligned(
        String.raw`\omega_0 &= ${motorData.noLoadSpeed_rpm}${RPM} \cdot \dfrac{2\pi}{60} = ${omega0}${RADPS}`,
        String.raw`P_{max} &= \dfrac{${motorData.stallTorque_Nm}${NM} \cdot ${omega0}${RADPS}}{4}`,
        String.raw`&= ${format(maxPower_W(motorData))}${W}`,
      ),
    };
  },
};

/** (2) The maximum power point, `n₀/2` and `τ_s/2`, in the motor and, through `i`, in the wheel. */
export const maxPowerPoint: RobotCalc = {
  id: 'max-power-point',
  compute(robot) {
    const motorData = drive(robot);
    const { noLoadSpeed_rpm, stallTorque_Nm, gearRatio, gearboxEfficiency, wheelRadius_m } =
      motorData;
    const motorSpeed_rpm = noLoadSpeed_rpm / 2;
    const motorTorque_Nm = stallTorque_Nm / 2;
    const wheelSpeed_rpm = motorSpeed_rpm / gearRatio;
    const wheelTorque_Nm = motorTorque_Nm * gearRatio * gearboxEfficiency;
    const v_mps = wheelSpeed_rpm * RPM_TO_RADPS * wheelRadius_m;
    return {
      latex: aligned(
        String.raw`n_{motor} &= \dfrac{n_0}{2}, & \tau_{motor} &= \dfrac{\tau_s}{2}`,
        String.raw`n_{rueda} &= \dfrac{n_{motor}}{i}, & \tau_{rueda} &= \tau_{motor}\,i\,\eta_{caja}`,
        String.raw`v &= \omega_{rueda}\,r`,
      ),
      substituted: aligned(
        String.raw`n_{motor} &= \dfrac{${noLoadSpeed_rpm}${RPM}}{2} = ${format(motorSpeed_rpm)}${RPM}`,
        String.raw`\tau_{motor} &= \dfrac{${stallTorque_Nm}${NM}}{2} = ${format(motorTorque_Nm)}${NM}`,
        String.raw`n_{rueda} &= \dfrac{${format(motorSpeed_rpm)}${RPM}}{${gearRatio}} = ${format(wheelSpeed_rpm)}${RPM}`,
        String.raw`\tau_{rueda} &= ${format(motorTorque_Nm)}${NM} \cdot ${gearRatio} \cdot ${gearboxEfficiency}`,
        String.raw`&= ${format(wheelTorque_Nm)}${NM}`,
        String.raw`v &= ${format(wheelSpeed_rpm)}${RPM} \cdot \dfrac{2\pi}{60} \cdot ${wheelRadius_m}\ \text{m}`,
        String.raw`&= ${format(v_mps)}\ \text{m/s}`,
      ),
    };
  },
};

/** (3) `I` at the maximum power point and `η_motor = P_max / (V I)`. */
export const currentEfficiency: RobotCalc = {
  id: 'current-efficiency',
  compute(robot) {
    const motorData = drive(robot);
    const { noLoadCurrent_A, stallCurrent_A, stallTorque_Nm, voltage_V } = motorData;
    const current_A = currentAtMaxPower_A(motorData);
    const power_W = maxPower_W(motorData);
    return {
      latex: aligned(
        String.raw`I &= I_0 + (I_s - I_0)\,\dfrac{\tau_{motor}}{\tau_s}`,
        String.raw`\eta_{motor} &= \dfrac{P_{max}}{V I}`,
      ),
      substituted: aligned(
        String.raw`I &= ${noLoadCurrent_A}${A} + (${stallCurrent_A}${A} - ${noLoadCurrent_A}${A}) \cdot \dfrac{${format(stallTorque_Nm / 2)}${NM}}{${stallTorque_Nm}${NM}}`,
        String.raw`&= ${format(current_A)}${A}`,
        String.raw`\eta_{motor} &= \dfrac{${format(power_W)}${W}}{${voltage_V}${V} \cdot ${format(current_A)}${A}} = ${format(power_W / (voltage_V * current_A))}`,
      ),
    };
  },
};

/** (4) `t_autonomía = C / (2 V I)` at the maximum power point, next to the stall worst case. */
export const autonomy: RobotCalc = {
  id: 'autonomy',
  compute(robot) {
    const motorData = drive(robot);
    const { batteryCapacity_Wh, voltage_V, stallCurrent_A } = motorData;
    const current_A = currentAtMaxPower_A(motorData);
    const electricalPower_W = MOTORS * voltage_V * current_A;
    const autonomy_h = batteryCapacity_Wh / electricalPower_W;
    const stallAutonomy_min = (batteryCapacity_Wh / (MOTORS * voltage_V * stallCurrent_A)) * MIN_PER_H;
    return {
      latex: String.raw`t_{\text{autonomía}} = \dfrac{C}{2\,V I}`,
      substituted: aligned(
        String.raw`t_{\text{autonomía}} &= \dfrac{${batteryCapacity_Wh}\ \text{Wh}}{2 \cdot ${voltage_V}${V} \cdot ${format(current_A)}${A}} = \dfrac{${batteryCapacity_Wh}\ \text{Wh}}{${format(electricalPower_W)}${W}}`,
        String.raw`&= ${format(autonomy_h)}\ \text{h} = ${format(autonomy_h * MIN_PER_H)}\ \text{min}`,
        String.raw`&\text{en bloqueo, } I_s = ${stallCurrent_A}${A}\text{: } ${format(stallAutonomy_min)}\ \text{min}`,
      ),
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [
  maxPower,
  maxPowerPoint,
  currentEfficiency,
  autonomy,
];
