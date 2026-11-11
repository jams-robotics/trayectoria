import { useState } from 'react';
import type { Translate } from '@trayectoria/i18n';
import type { MobileSpec } from '@trayectoria/robot-spec';
import type { WheelCommand } from '@trayectoria/sim-core';

import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import type { DiffDriveMode } from './compute';
import { maneuverParams } from './controls';
import type { ManeuverValues } from './controls';
import { maneuverDuration_s, phaseAt, phaseCommand, planOf } from './maneuver';
import type { Maneuver, ManeuverPhase, ManeuverPlan } from './maneuver';

/** What the widget needs of the maneuver: its switch, its sliders and the plan the model runs. */
export interface ManeuverControls {
  /** True in `mode: 'inverse'` with the `maneuver` prop; otherwise the widget does not change. */
  available: boolean;
  active: boolean;
  /** The plan the model runs, or `null` while the maneuver is off. */
  plan: ManeuverPlan | null;
  params: readonly ParamPanelParam[];
  toggle: () => void;
  /** Applies a change of «Giro» or «Avance»; false for any other slider. */
  change: (key: string, value: number) => boolean;
}

/** The current phase of the maneuver and its total duration `T`. */
export interface ManeuverReadout {
  phase: ManeuverPhase;
  duration_s: number;
}

/**
 * The switch and the sliders of the maneuver (#394). It starts off, so `initialTime_s` always
 * opens with it off; the caller restarts the run on every change.
 */
export function useManeuver(
  maneuver: Maneuver | undefined,
  mode: DiffDriveMode,
  t: Translate,
): ManeuverControls {
  const [active, setActive] = useState(false);
  const [values, setValues] = useState<ManeuverValues>(() => ({
    turn_deg: maneuver?.turn_deg ?? 0,
    distance_m: maneuver?.distance_m ?? 0,
  }));
  const available = maneuver !== undefined && mode === 'inverse';
  const on = available && active;
  return {
    available,
    active: on,
    plan: on ? planOf(maneuver, values.turn_deg, values.distance_m) : null,
    params: maneuverParams(values, t),
    toggle: () => {
      setActive((current) => !current);
    },
    change: (key, value) => {
      if (key === 'maneuverTurn') setValues((current) => ({ ...current, turn_deg: value }));
      else if (key === 'maneuverDistance') {
        setValues((current) => ({ ...current, distance_m: value }));
      } else return false;
      return true;
    },
  };
}

/**
 * The command of the current instant: the phase of the maneuver at the time of the state, or the
 * sliders while it is off (#394).
 */
export function commandNow(
  plan: ManeuverPlan | null,
  t_s: number,
  sliders: WheelCommand,
  spec: MobileSpec,
): { command: WheelCommand; maneuver: ManeuverReadout | null } {
  if (plan === null) return { command: sliders, maneuver: null };
  const phase = phaseAt(plan, t_s);
  return {
    command: phaseCommand(plan, phase, spec),
    maneuver: { phase, duration_s: maneuverDuration_s(plan) },
  };
}
