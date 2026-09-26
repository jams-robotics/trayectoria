import type { RobotSpec } from '@trayectoria/robot-spec';

import type { RobotCalc } from '../../../index';

/**
 * «Al robot» calcs of T-5.4 (docs/CURRICULUM.md § T-5.4): the odometry step of the hook (400 and
 * 440 ticks) with the wheel, encoder and wheelbase of «Mi robot», the pose it gives from
 * (0, 0, 0), and the distance error of a wheel 1 mm larger than believed after 10 m by odometry.
 * The MDX renders them with `<RobotFormula calc="ruta-1/m05-t04/wheel-arcs" />`, `…/step`,
 * `…/pose` and `…/radius-error`.
 */

/** Four significant figures, keeping trailing zeros: 0.2234 m, 0.01745 m, 0.3125 m. */
const SIGNIFICANT_FIGURES = 4;

/** Ticks of the hook, left and right. */
const HOOK_DELTA_TICKS_L = 400;
const HOOK_DELTA_TICKS_R = 440;

/** The radius error and the distance reported by the odometry in the error calc. */
const RADIUS_ERROR_M = 0.001;
const ODOMETRY_DISTANCE_M = 10;

/**
 * Reference robot (docs/CURRICULUM.md, header: r = 0.032 m, L = 0.15 m, N_e = 360). `content`
 * takes robot-spec for its types only (#246), so the numbers are here.
 */
const REFERENCE_WHEEL_RADIUS_M = 0.032;
const REFERENCE_WHEEL_BASE_M = 0.15;
const REFERENCE_TICKS_PER_REV = 360;

interface Drive {
  readonly wheelRadius_m: number;
  readonly wheelBase_m: number;
  readonly encoderTicksPerRev: number;
}

/**
 * Wheel, wheelbase and encoder of the profile. `encoderTicksPerRev` is optional in RobotSpec: a
 * profile without it takes the reference N_e = 360 (#301); an arm profile has no wheels and takes
 * the whole reference robot (docs/CONTENT-STANDARDS.md §2.5).
 */
function drive(robot: RobotSpec): Drive {
  if (robot.mobile === undefined) {
    return {
      wheelRadius_m: REFERENCE_WHEEL_RADIUS_M,
      wheelBase_m: REFERENCE_WHEEL_BASE_M,
      encoderTicksPerRev: REFERENCE_TICKS_PER_REV,
    };
  }
  return {
    wheelRadius_m: robot.mobile.wheelRadius_m,
    wheelBase_m: robot.mobile.wheelBase_m,
    encoderTicksPerRev: robot.mobile.encoderTicksPerRev ?? REFERENCE_TICKS_PER_REV,
  };
}

interface OdometryStep extends Drive {
  readonly deltaSL_m: number;
  readonly deltaSR_m: number;
  readonly deltaS_m: number;
  readonly deltaTheta_rad: number;
}

/** `Δs_{L,R} = 2πr·Δticks / N_e`, `Δs = (Δs_R + Δs_L)/2` and `Δθ = (Δs_R − Δs_L)/L`. */
function hookStep(robot: RobotSpec): OdometryStep {
  const wheel = drive(robot);
  const arc_m = (deltaTicks: number) =>
    (2 * Math.PI * wheel.wheelRadius_m * deltaTicks) / wheel.encoderTicksPerRev;
  const deltaSL_m = arc_m(HOOK_DELTA_TICKS_L);
  const deltaSR_m = arc_m(HOOK_DELTA_TICKS_R);
  return {
    ...wheel,
    deltaSL_m,
    deltaSR_m,
    deltaS_m: (deltaSR_m + deltaSL_m) / 2,
    deltaTheta_rad: (deltaSR_m - deltaSL_m) / wheel.wheelBase_m,
  };
}

function format(value: number): string {
  return value.toPrecision(SIGNIFICANT_FIGURES);
}

/** `Δs_L = 2πr·Δticks_L / N_e` and the same for the right wheel. */
export const wheelArcs: RobotCalc = {
  id: 'wheel-arcs',
  compute(robot) {
    const { wheelRadius_m, encoderTicksPerRev, deltaSL_m, deltaSR_m } = hookStep(robot);
    const arc = (side: string, deltaTicks: number, arc_m: number) =>
      String.raw`\Delta s_${side} = \dfrac{2\pi \cdot ${wheelRadius_m}\ \text{m} \cdot ${deltaTicks}}{${encoderTicksPerRev}}` +
      String.raw` = ${format(arc_m)}\ \text{m}`;
    return {
      latex: String.raw`\Delta s_L = \dfrac{2\pi r\,\Delta\text{ticks}_L}{N_e},\quad \Delta s_R = \dfrac{2\pi r\,\Delta\text{ticks}_R}{N_e}`,
      substituted:
        arc('L', HOOK_DELTA_TICKS_L, deltaSL_m) +
        String.raw`,\quad ` +
        arc('R', HOOK_DELTA_TICKS_R, deltaSR_m),
    };
  },
};

/** `Δs = (Δs_R + Δs_L)/2` and `Δθ = (Δs_R − Δs_L)/L`. */
export const step: RobotCalc = {
  id: 'step',
  compute(robot) {
    const { wheelBase_m, deltaSL_m, deltaSR_m, deltaS_m, deltaTheta_rad } = hookStep(robot);
    const sL = String.raw`${format(deltaSL_m)}\ \text{m}`;
    const sR = String.raw`${format(deltaSR_m)}\ \text{m}`;
    return {
      latex: String.raw`\Delta s = \dfrac{\Delta s_R + \Delta s_L}{2},\quad \Delta\theta = \dfrac{\Delta s_R - \Delta s_L}{L}`,
      substituted:
        String.raw`\Delta s = \dfrac{${sR} + ${sL}}{2} = ${format(deltaS_m)}\ \text{m},\quad ` +
        String.raw`\Delta\theta = \dfrac{${sR} - ${sL}}{${wheelBase_m}\ \text{m}} = ${format(deltaTheta_rad)}\ \text{rad}`,
    };
  },
};

/** Pose after the step from (0, 0, 0), with the mid-step heading `θ + Δθ/2` and θ = 0. */
export const pose: RobotCalc = {
  id: 'pose',
  compute(robot) {
    const { deltaS_m, deltaTheta_rad } = hookStep(robot);
    const midHeading_rad = deltaTheta_rad / 2;
    const deltaS = String.raw`${format(deltaS_m)}\ \text{m}`;
    const halfTurn = String.raw`\tfrac{${format(deltaTheta_rad)}}{2}`;
    return {
      latex: String.raw`x = \Delta s\cos\tfrac{\Delta\theta}{2},\quad y = \Delta s\sin\tfrac{\Delta\theta}{2},\quad \theta = \Delta\theta`,
      substituted:
        String.raw`x = ${deltaS} \cdot \cos${halfTurn} = ${format(deltaS_m * Math.cos(midHeading_rad))}\ \text{m},\quad ` +
        String.raw`y = ${deltaS} \cdot \sin${halfTurn} = ${format(deltaS_m * Math.sin(midHeading_rad))}\ \text{m},\quad ` +
        String.raw`\theta = ${format(deltaTheta_rad)}\ \text{rad}`,
    };
  },
};

/**
 * The odometry believes the radius r of the profile and reports D = 10 m; a real wheel 1 mm
 * larger covers s = D·(r + 1 mm)/r, so `s − D = D·(1 mm)/r`.
 */
export const radiusError: RobotCalc = {
  id: 'radius-error',
  compute(robot) {
    const { wheelRadius_m } = drive(robot);
    return {
      latex: String.raw`s - D = D\,\dfrac{0.001\ \text{m}}{r}`,
      substituted:
        String.raw`s - D = ${ODOMETRY_DISTANCE_M}\ \text{m} \cdot \dfrac{${RADIUS_ERROR_M}\ \text{m}}{${wheelRadius_m}\ \text{m}}` +
        String.raw` = ${format((ODOMETRY_DISTANCE_M * RADIUS_ERROR_M) / wheelRadius_m)}\ \text{m}`,
    };
  },
};

/** The calcs of the topic; `content/index.ts` registers them. */
export const robotCalcs: readonly RobotCalc[] = [wheelArcs, step, pose, radiusError];
