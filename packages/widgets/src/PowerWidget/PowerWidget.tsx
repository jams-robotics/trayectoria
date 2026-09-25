import { useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import { SimControls } from '../SimControls/SimControls';
import { LiveStatus, ReadoutPanel } from '../shared/ReadoutPanel';
import { SimLayout } from '../shared/SimLayout';
import { PotentialBar } from './bar';
import { heightAt, liftSpeed, potentialEnergyAt, reachedTop, riseTime, topEnergy } from './compute';
import type { Lift } from './compute';
import { applyChange, panelRows, paramsOf, statusOf } from './rows';
import { PowerScene } from './scene';
import { useTimeline } from './timeline';

/** Lift height when the topic does not set one, in metres (docs/WIDGETS.md). */
const DEFAULT_LIFT_HEIGHT_M = 1;

export interface PowerWidgetProps {
  initial: { power_W: number; mass_kg: number };
  /** Fixed height of the lift, in metres, in [0.2, 2]; it has no slider. Defaults to 1 m. */
  liftHeight_m?: number;
  /** Time the widget opens at, in seconds. Defaults to the start of the lift. */
  initialTime_s?: number;
}

/** The `E_p` bar at the left of the scene of the lift. */
function LiftView({ lift, t_s, t }: { lift: Lift; t_s: number; t: Translate }): JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <PotentialBar potential_J={potentialEnergyAt(lift, t_s)} scale_J={topEnergy(lift)} t={t} />
      <div className="min-w-0 flex-1">
        <PowerScene
          liftHeight_m={lift.liftHeight_m}
          height_m={heightAt(lift, t_s)}
          speed_mps={liftSpeed(lift)}
          rising={!reachedTop(lift, t_s)}
          t={t}
        />
      </div>
    </div>
  );
}

/**
 * A motor lifting a load at constant speed: with more power it rises faster, and an `E_p` bar
 * fills up to the final height (docs/WIDGETS.md, PowerWidget; T-3.2).
 *
 * The playback advances a model whose state is only the elapsed time; the height, the speed
 * and the energies come from the closed forms of `compute.ts` at the current `t`. Layout of
 * docs/DESIGN.md §6: viewer, controls and sliders on the left, values on the right.
 */
export function PowerWidget({
  initial,
  liftHeight_m = DEFAULT_LIFT_HEIGHT_M,
  initialTime_s = 0,
}: PowerWidgetProps): JSX.Element {
  const t = useT();
  const [lift, setLift] = useState<Lift>(() => ({ ...initial, liftHeight_m }));
  // `H` is a fixed prop: the state only holds what the sliders edit.
  const shown: Lift = { ...lift, liftHeight_m };
  const timeline = useTimeline(riseTime(shown), initialTime_s);
  const { t_s } = timeline;
  return (
    <SimLayout
      viewer={
        <>
          <LiftView lift={shown} t_s={t_s} t={t} />
          <SimControls {...timeline.driver} {...timeline.controls} t_s={t_s} />
        </>
      }
      values={
        <>
          <ReadoutPanel title={t('widgets.PowerWidget.panel')} rows={panelRows(shown, t_s, t)} />
          <LiveStatus text={statusOf(shown, t_s, t)} />
        </>
      }
      params={
        <ParamPanel
          params={paramsOf(shown, t)}
          onChange={(key, value) => {
            setLift((current) => applyChange(current, key, value));
          }}
        />
      }
    />
  );
}
