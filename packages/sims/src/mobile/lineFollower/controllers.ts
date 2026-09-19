import {
  REFERENCE_PID_PARAMS,
  createManualController,
  createOnOffController,
  createPidController,
  createProportionalController,
  maxWheelSpeed_radps,
} from '@trayectoria/sim-core';
import type { Controller } from '@trayectoria/sim-core';
import type { MobileSpec } from '@trayectoria/robot-spec';
import type { ParamPanelParam } from '@trayectoria/widgets';

/** Numeric parameters of a controller, as `ParamPanel` and `LineFollowerWidget` carry them. */
export type ControllerParams = Readonly<Record<string, number>>;

/** Controllers of the selector (docs/DESIGN.md §6: Manual · On/off · P · PID). */
export type ControllerId = 'manual' | 'onoff' | 'p' | 'pid';

/** One entry of the registry: how to build the controller and what the panel shows for it. */
export interface ControllerDef {
  readonly id: ControllerId;
  /** i18n key of its tab label. */
  readonly labelKey: string;
  /** Parameters the panel edits, in the order they are shown. */
  readonly keys: readonly string[];
  /** Values the widget opens with when `initialParams` does not carry them. */
  readonly defaults: ControllerParams;
  /** Builds the controller of sim-core from a full set of parameters. */
  create(params: ControllerParams): Controller<unknown>;
}

/** Order of the tabs of the selector (docs/DESIGN.md §6). */
export const CONTROLLER_IDS: readonly ControllerId[] = ['manual', 'onoff', 'p', 'pid'];

/**
 * Slider range of every parameter, as `[min, max, step]` (#127, decisión 5). `omegaBase_radps`
 * and `delta_radps` are capped by the robot rather than by a constant, so their maximum is
 * `maxWheelSpeed_radps(spec)` and lives in `controllerParams`, not here.
 */
const RANGES: Readonly<Record<string, readonly [number, number, number]>> = {
  kp: [0, 20, 0.1],
  ki: [0, 10, 0.1],
  kd: [0, 5, 0.05],
  iMax: [0, 10, 0.1],
  threshold: [0, 1, 0.01],
};

/** Step of the two speed parameters, in rad/s. */
const SPEED_STEP_RADPS = 0.5;

function numberAt(params: ControllerParams, key: string, fallback: number): number {
  const value = params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Registry of the controllers the simulator offers, each wired to the implementation of
 * sim-core (`docs/ARCHITECTURE.md` §4.4). `manual` drives both wheels at `omegaBase_radps` and
 * ignores the sensors; `onoff` adds a fixed `delta_radps` to one wheel and takes it from the
 * other; `p` and `pid` feed back on `reading.linePosition`. The PID opens on the reference
 * gains of sim-core, the ones the content starts from.
 */
export const CONTROLLERS: Readonly<Record<ControllerId, ControllerDef>> = {
  manual: {
    id: 'manual',
    labelKey: 'sims.lineFollower.controller.manual',
    keys: ['omegaBase_radps'],
    defaults: { omegaBase_radps: 10 },
    create: (params) => {
      const omega_radps = numberAt(params, 'omegaBase_radps', 10);
      return createManualController({ omegaL_radps: omega_radps, omegaR_radps: omega_radps });
    },
  },
  onoff: {
    id: 'onoff',
    labelKey: 'sims.lineFollower.controller.onoff',
    keys: ['omegaBase_radps', 'delta_radps'],
    defaults: { omegaBase_radps: 10, delta_radps: 4 },
    create: (params) =>
      createOnOffController({
        omegaBase_radps: numberAt(params, 'omegaBase_radps', 10),
        delta_radps: numberAt(params, 'delta_radps', 4),
      }),
  },
  p: {
    id: 'p',
    labelKey: 'sims.lineFollower.controller.p',
    keys: ['omegaBase_radps', 'kp'],
    defaults: { omegaBase_radps: 10, kp: 10 },
    create: (params) =>
      createProportionalController({
        omegaBase_radps: numberAt(params, 'omegaBase_radps', 10),
        kp: numberAt(params, 'kp', 10),
      }),
  },
  pid: {
    id: 'pid',
    labelKey: 'sims.lineFollower.controller.pid',
    keys: ['omegaBase_radps', 'kp', 'ki', 'kd', 'iMax'],
    defaults: { ...REFERENCE_PID_PARAMS },
    create: (params) =>
      createPidController({
        omegaBase_radps: numberAt(params, 'omegaBase_radps', REFERENCE_PID_PARAMS.omegaBase_radps),
        kp: numberAt(params, 'kp', REFERENCE_PID_PARAMS.kp),
        ki: numberAt(params, 'ki', REFERENCE_PID_PARAMS.ki),
        kd: numberAt(params, 'kd', REFERENCE_PID_PARAMS.kd),
        iMax: numberAt(params, 'iMax', REFERENCE_PID_PARAMS.iMax),
      }),
  },
};

/** True when `id` names a controller of the registry. */
export function isControllerId(id: string): id is ControllerId {
  return Object.hasOwn(CONTROLLERS, id);
}

/** Range of one parameter: the speeds are bounded by the robot, the gains by `RANGES`. */
function rangeOf(key: string, spec: MobileSpec): readonly [number, number, number] {
  if (key === 'omegaBase_radps' || key === 'delta_radps') {
    return [0, maxWheelSpeed_radps(spec), SPEED_STEP_RADPS];
  }
  return RANGES[key] ?? [0, 1, 0.01];
}

/**
 * Sliders `ParamPanel` shows for `id`, in the order of its `keys`. `params` supplies the current
 * values and the defaults of the controller fill in whatever is missing, so a widget opened with
 * a partial `initialParams` still shows every slider. `t` translates the label and the unit.
 */
export function controllerParams(
  id: ControllerId,
  params: ControllerParams,
  spec: MobileSpec,
  t: (key: string) => string,
): readonly ParamPanelParam[] {
  const def = CONTROLLERS[id];
  return def.keys.map((key) => {
    const [min, max, step] = rangeOf(key, spec);
    return {
      key,
      label: t(`sims.lineFollower.param.${key}`),
      unit: t(`sims.lineFollower.unit.${key}`),
      min,
      max,
      step,
      value: numberAt(params, key, numberAt(def.defaults, key, min)),
    };
  });
}
