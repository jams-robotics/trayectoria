import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-4.5 (docs/CURRICULUM.md § T-4.5): the linear resolution of the encoder of
 * «Mi robot», `res = 2πr / N_e`, and the ticks it counts per metre, `ticks = s·N_e / (2πr)` with
 * s = 1 m. The MDX renders them with `<RobotFormula calc="ruta-1/m04-t05/encoder-resolution" />`
 * and `…/ticks-per-meter`.
 */

/** Four significant figures for the resolution, in mm: 0.5585 mm. */
const RESOLUTION_SIGNIFICANT_FIGURES = 4;

const MM_PER_M = 1000;

/** The distance of the ticks-per-metre calc. */
const ONE_METER_M = 1;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, N_e = 360). `content` takes
 * robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_TICKS_PER_REV = 360;
const REFERENCE_WHEEL_RADIUS_M = 0.032;

interface Encoder {
  readonly wheelRadius_m: number;
  readonly encoderTicksPerRev: number;
}

/**
 * Wheel and encoder of the profile. `encoderTicksPerRev` is optional in RobotSpec: a profile
 * without it takes the reference N_e = 360 (#301); an arm profile has no wheels and takes the
 * whole reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function encoder(robot: RobotSpec): Encoder {
  if (robot.mobile === undefined) {
    return {
      wheelRadius_m: REFERENCE_WHEEL_RADIUS_M,
      encoderTicksPerRev: REFERENCE_TICKS_PER_REV,
    };
  }
  return {
    wheelRadius_m: robot.mobile.wheelRadius_m,
    encoderTicksPerRev: robot.mobile.encoderTicksPerRev ?? REFERENCE_TICKS_PER_REV,
  };
}

/** `res = 2πr / N_e`. */
function resolution_m({ wheelRadius_m, encoderTicksPerRev }: Encoder): number {
  return (2 * Math.PI * wheelRadius_m) / encoderTicksPerRev;
}

/** `res = 2πr / N_e`, shown in mm. */
export const encoderResolution: RobotCalc = {
  id: 'encoder-resolution',
  compute(robot) {
    const wheel = encoder(robot);
    const resolution_mm = resolution_m(wheel) * MM_PER_M;
    return {
      latex: String.raw`\text{res} = \dfrac{2\pi r}{N_e}`,
      substituted:
        String.raw`\text{res} = \dfrac{2\pi \cdot ${wheel.wheelRadius_m}\ \text{m}}{${wheel.encoderTicksPerRev}}` +
        String.raw` = ${resolution_mm.toPrecision(RESOLUTION_SIGNIFICANT_FIGURES)}\ \text{mm}`,
    };
  },
};

/** `ticks = s·N_e / (2πr)` for s = 1 m, rounded to a whole tick. */
export const ticksPerMeter: RobotCalc = {
  id: 'ticks-per-meter',
  compute(robot) {
    const wheel = encoder(robot);
    const ticks = Math.round(ONE_METER_M / resolution_m(wheel));
    return {
      latex: String.raw`\text{ticks} = \dfrac{s\,N_e}{2\pi r}`,
      substituted:
        String.raw`\text{ticks} = \dfrac{${ONE_METER_M}\ \text{m} \cdot ${wheel.encoderTicksPerRev}}{2\pi \cdot ${wheel.wheelRadius_m}\ \text{m}}` +
        String.raw` = ${ticks}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [encoderResolution, ticksPerMeter];
