import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-3.2 (docs/CURRICULUM.md § T-3.2): the electrical power of the two motors
 * of «Mi robot», `P_el = 2·V·I`, and the autonomy `t = C / P_el`. The MDX renders them with
 * `<RobotFormula calc="ruta-1/m03-t02/electrical-power" />` and `…/autonomy`.
 */

/** Three significant figures: 14.4 W, 0.771 h and 46.3 min in the golden values. */
const SIGNIFICANT_FIGURES = 3;

const MOTORS = 2;
const MIN_PER_H = 60;

/**
 * Current of each motor: the datasheet of the T-0.1 hook (1.2 A), not a profile field (#300).
 */
const DATASHEET_CURRENT_A = 1.2;

/**
 * Reference robot (docs/CURRICULUM.md, header: 6 V, 11.1 Wh). `content` takes robot-spec for its
 * types only (#246), so the numbers are here.
 */
const REFERENCE_SUPPLY = { voltage_V: 6, batteryCapacity_Wh: 11.1 } as const;

interface Supply {
  readonly voltage_V: number;
  readonly batteryCapacity_Wh: number;
}

/**
 * Motor voltage and battery capacity of the profile. `motor` and `battery` are optional in
 * RobotSpec: a missing one takes the reference value; an arm profile has no wheels and takes the
 * whole reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function supply(robot: RobotSpec): Supply {
  if (robot.mobile === undefined) return REFERENCE_SUPPLY;
  return {
    voltage_V: robot.mobile.motor?.nominalVoltage_V ?? REFERENCE_SUPPLY.voltage_V,
    batteryCapacity_Wh: robot.mobile.battery?.capacity_Wh ?? REFERENCE_SUPPLY.batteryCapacity_Wh,
  };
}

function electricalPower_W(voltage_V: number): number {
  return MOTORS * voltage_V * DATASHEET_CURRENT_A;
}

function format(value: number): string {
  return String(Number(value.toPrecision(SIGNIFICANT_FIGURES)));
}

/** `P_el = 2·V·I`: two motors at the voltage of the profile and 1.2 A each. */
export const electricalPower: RobotCalc = {
  id: 'electrical-power',
  compute(robot) {
    const { voltage_V } = supply(robot);
    return {
      latex: String.raw`P_{el} = 2 \cdot V I`,
      substituted:
        String.raw`P_{el} = 2 \cdot ${voltage_V}\ \text{V} \cdot ${DATASHEET_CURRENT_A}\ \text{A}` +
        String.raw` = ${format(electricalPower_W(voltage_V))}\ \text{W}`,
    };
  },
};

/** `t_autonomía = C / P_el`, in hours and in minutes. */
export const autonomy: RobotCalc = {
  id: 'autonomy',
  compute(robot) {
    const { voltage_V, batteryCapacity_Wh } = supply(robot);
    const power_W = electricalPower_W(voltage_V);
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
