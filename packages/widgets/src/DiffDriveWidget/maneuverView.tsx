import type { JSX } from 'react';
import { radToDeg } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';
import type { MobileSpec } from '@trayectoria/robot-spec';

import { Rect } from '../Scene2D/primitives/Rect';
import { Trace } from '../Scene2D/primitives/Trace';
import type { Pose } from './compute';
import type { ManeuverPhase, ManeuverPlan } from './maneuver';

/** The maneuver about to run, as the scene draws it: its straight stretch and its end pose. */
export interface PlannedManeuver {
  path_m: ReadonlyArray<readonly [number, number]>;
  end: Pose;
}

/**
 * The maneuver before it runs: the stretch of phase 2 dotted and the chassis outlined where it
 * will stop, both muted, so the three moves can be read before pressing «Reproducir» (v1.5).
 */
export function PlannedPath({
  planned,
  spec,
}: {
  planned: PlannedManeuver;
  spec: MobileSpec;
}): JSX.Element {
  return (
    <>
      <Trace points_m={planned.path_m} color="color-fg-muted" />
      <Rect
        center_m={[planned.end.x_m, planned.end.y_m]}
        width_m={spec.length_m}
        height_m={spec.width_m}
        angle_rad={planned.end.theta_rad}
        color="color-fg-muted"
      />
    </>
  );
}

/**
 * The maneuver in words under the viewer: the plan before it starts, the move while it runs and,
 * once over, that the next one starts from there (v1.5). The panel row alone was missed.
 */
export function ManeuverLine({
  plan,
  readout,
  t_s,
  t,
}: {
  plan: ManeuverPlan | null;
  readout: { phase: ManeuverPhase } | null;
  t_s: number;
  t: Translate;
}): JSX.Element | null {
  if (plan === null || readout === null) return null;
  const { phase } = readout;
  const started = t_s > 0;
  const values = {
    turn: Math.round(radToDeg(plan.turn_rad)),
    back: Math.round(radToDeg(-plan.turn_rad)),
    distance: plan.distance_m.toFixed(2),
  };
  const key = !started ? 'Plan' : phase === 'done' ? 'Done' : `Phase${String(phase)}`;
  return (
    <p className="text-fg m-0 font-mono text-sm" aria-live="polite">
      {t(`widgets.DiffDriveWidget.maneuverLine${key}`, values)}
    </p>
  );
}
