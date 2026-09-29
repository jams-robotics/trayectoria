import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-3.2 (docs/CURRICULUM.md § T-3.2): the electrical power of the two motors
 * of «Mi robot» stalled at full voltage, `P_el = 2·V·I_s`, and the worst-case autonomy
 * `t = C / P_el` (#609). The MDX renders them with
 * `<RobotFormula calc="ruta-1/m03-t02/electrical-power" />` and `…/autonomy`.
 */

/** Three significant figures: 14.4 W, 0.771 h and 46.3 min in the golden values. */
const SIGNIFICANT_FIGURES = 3;

const MOTORS = 2;
const MIN_PER_H = 60;

/**
 * Reference robot (docs/CURRICULUM.md, header: 6 V, I_s = 1.2 A of stall current, 11.1 Wh).
 * `content` takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_SUPPLY = { voltage_V: 6, stallCurrent_A: 1.2, batteryCapacity_Wh: 11.1 } as const;

interface Supply {
  readonly voltage_V: number;
  readonly stallCurrent_A: number;
  readonly batteryCapacity_Wh: number;
}

/**
 * Motor voltage, stall current and battery capacity of the profile. `motor`, `battery` and
 * `motor.stallCurrent_A` are optional in RobotSpec: a missing one takes the reference value
 * (#609); an arm profile has no wheels and takes the whole reference robot
 * (docs/CONTENT-STANDARDS.md §2.5).
 */
function supply(robot: RobotSpec): Supply {
  if (robot.mobile === undefined) return REFERENCE_SUPPLY;
  const { motor, battery } = robot.mobile;
  return {
    voltage_V: motor?.nominalVoltage_V ?? REFERENCE_SUPPLY.voltage_V,
    stallCurrent_A: motor?.stallCurrent_A ?? REFERENCE_SUPPLY.stallCurrent_A,
    batteryCapacity_Wh: battery?.capacity_Wh ?? REFERENCE_SUPPLY.batteryCapacity_Wh,
  };
}

/** `P_el = 2·V·I_s`: both motors stalled at full voltage, the most current they ever draw. */
function electricalPower_W({ voltage_V, stallCurrent_A }: Supply): number {
  return MOTORS * voltage_V * stallCurrent_A;
}

function format(value: number): string {
  return String(Number(value.toPrecision(SIGNIFICANT_FIGURES)));
}

/** `P_el = 2·V·I`: two motors at the voltage and the stall current of the profile. */
export const electricalPower: RobotCalc = {
  id: 'electrical-power',
  compute(robot) {
    const current = supply(robot);
    const { voltage_V, stallCurrent_A } = current;
    return {
      latex: String.raw`P_{el} = 2 \cdot V I`,
      substituted:
        String.raw`P_{el} = 2 \cdot ${voltage_V}\ \text{V} \cdot ${stallCurrent_A}\ \text{A}` +
        String.raw` = ${format(electricalPower_W(current))}\ \text{W}`,
    };
  },
};

/** `t_autonomía = C / P_el`, in hours and in minutes: the lower bound, with the motors stalled. */
export const autonomy: RobotCalc = {
  id: 'autonomy',
  compute(robot) {
    const current = supply(robot);
    const { batteryCapacity_Wh } = current;
    const power_W = electricalPower_W(current);
    const autonomy_h = batteryCapacity_Wh / power_W;
    return {
      latex: String.raw`t_{\text{autonomía}} = \dfrac{C}{P_{el}}`,
      substituted:
        String.raw`t_{\text{autonomía}} = \dfrac{${batteryCapacity_Wh}\ \text{Wh}}{${format(power_W)}\ \text{W}}` +
        String.raw` = ${format(autonomy_h)}\ \text{h} = ${format(autonomy_h * MIN_PER_H)}\ \text{min}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [electricalPower, autonomy];
