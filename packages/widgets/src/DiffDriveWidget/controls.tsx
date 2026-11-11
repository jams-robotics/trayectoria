import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import type { DiffDriveMode, DiffDriveShow } from './compute';
import { MANEUVER_DISTANCE_RANGE_M, MANEUVER_TURN_RANGE_DEG } from './maneuver';
import { Notice, theta0Of, thetaParam } from './panels';
import type { Timeline } from './timeline';
import type { ManeuverControls } from './useManeuver';

// The same button as «Paso» and «Reiniciar» of SimControls; pressed, it takes the primary colours.
const BUTTON =
  'inline-flex h-9 w-fit items-center rounded-sm border px-3 text-sm font-semibold transition-colors duration-[120ms]';
const ACTIVE = `${BUTTON} bg-primary text-primary-fg border-primary hover:bg-primary-hover`;
const INACTIVE = `${BUTTON} bg-bg-raised text-fg border-border hover:border-fg-muted`;

/**
 * The sliders each topic leaves in view, which are the ones its `Experimento` set: `visibleKeys`
 * of a mode and its `show`. The rest sit behind «Más controles» (v1.5). `forward` with `frames`
 * moves the robot by hand and `θ₀`; `odometry` with `frames` is the drift of the calibration
 * and without them the encoders.
 */
export function visibleKeys(
  mode: DiffDriveMode,
  show: readonly DiffDriveShow[],
  maneuver = false,
): readonly string[] {
  const frames = show.includes('frames');
  // With the maneuver on, `θ₀` beside «Giro» read as part of it: it turns the robot right away (v1.5).
  if (maneuver) return ['maneuverTurn', 'maneuverDistance'];
  if (mode === 'odometry') {
    return frames ? ['believedRadius', 'believedBase'] : ['omegaL', 'omegaR', 'ticksPerRev'];
  }
  if (mode === 'inverse') {
    const twist = ['v', 'omega', 'maneuverTurn', 'maneuverDistance'];
    return frames ? [...twist, 'theta'] : twist;
  }
  return frames ? ['theta'] : ['omegaL', 'omegaR'];
}

/** The sliders whose key is in `keys`, and the rest, each in its order. */
function splitParams(
  all: readonly ParamPanelParam[],
  keys: readonly string[],
): { inView: ParamPanelParam[]; folded: ParamPanelParam[] } {
  return {
    inView: all.filter((param) => keys.includes(param.key)),
    folded: all.filter((param) => !keys.includes(param.key)),
  };
}

/** The values of the «Giro» and «Avance» sliders of the maneuver. */
export interface ManeuverValues {
  turn_deg: number;
  distance_m: number;
}

/** The «Giro» and «Avance» sliders that replace `v` and `ω` while the maneuver is on (#394). */
export function maneuverParams(values: ManeuverValues, t: Translate): readonly ParamPanelParam[] {
  return [
    {
      key: 'maneuverTurn',
      label: t('widgets.DiffDriveWidget.paramManeuverTurn'),
      unit: t('widgets.DiffDriveWidget.unitDeg'),
      value: values.turn_deg,
      ...MANEUVER_TURN_RANGE_DEG,
    },
    {
      key: 'maneuverDistance',
      label: t('widgets.DiffDriveWidget.paramManeuverDistance'),
      unit: t('widgets.DiffDriveWidget.unitM'),
      value: values.distance_m,
      ...MANEUVER_DISTANCE_RANGE_M,
    },
  ];
}

/** The «Maniobra en tres movimientos» switch: a button with `aria-pressed` (#394). */
export function ManeuverToggle({
  active,
  onToggle,
  t,
}: {
  active: boolean;
  onToggle: () => void;
  t: Translate;
}): JSX.Element {
  return (
    <button
      type="button"
      className={active ? ACTIVE : INACTIVE}
      aria-pressed={active}
      onClick={onToggle}
    >
      {t('widgets.DiffDriveWidget.toggleManeuver')}
    </button>
  );
}

/** The maneuver switch; turning it on or off starts the run over from the origin (v1.5). */
function ManeuverButtons({
  sequence,
  resetAll,
  t,
}: {
  sequence: ManeuverControls;
  resetAll: () => void;
  t: Translate;
}): JSX.Element | null {
  if (!sequence.available) return null;
  return (
    <ManeuverToggle
      active={sequence.active}
      onToggle={() => {
        sequence.toggle();
        resetAll();
      }}
      t={t}
    />
  );
}

/**
 * The sliders of the mode across both columns of the parameters, with the maneuver switch (when
 * there is one) and the saturation notice above them; `folded` sit behind «Más controles»
 * (#92, decision 4; #394; v1.5).
 */
export function Sliders({
  toggle,
  params,
  folded,
  onChange,
  onReset,
  feasible,
  t,
}: {
  toggle: JSX.Element | null;
  params: readonly ParamPanelParam[];
  folded: readonly ParamPanelParam[];
  onChange: (key: string, value: number) => void;
  /** «Valores iniciales» also puts the robot back at the origin (v1.5). */
  onReset?: () => void;
  feasible: boolean;
  t: Translate;
}): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-3 lg:col-span-2">
      {toggle}
      {feasible ? null : <Notice text={t('widgets.DiffDriveWidget.saturated')} tone="error" />}
      <ParamPanel
        params={params}
        folded={folded}
        onChange={onChange}
        layout="grid"
        {...(onReset === undefined ? {} : { onReset })}
      />
    </div>
  );
}

interface ModeSlidersProps {
  mode: DiffDriveMode;
  show: readonly DiffDriveShow[];
  sliders: {
    params: readonly ParamPanelParam[];
    onSlider: (key: string, value: number) => void;
  };
  sequence: ManeuverControls;
  timeline: Pick<Timeline, 'restart' | 'resetAll' | 'setTheta0' | 'theta0_rad'> & {
    driver: Pick<Timeline['driver'], 'running'>;
  };
  feasible: boolean;
  t: Translate;
}

/**
 * The sliders of the mode or, with the maneuver on, its «Giro» and «Avance»; the switch sits
 * above them and every change of the maneuver restarts the run (#394).
 */
export function ModeSliders({
  mode,
  show,
  sliders,
  sequence,
  timeline,
  feasible,
  t,
}: ModeSlidersProps): JSX.Element {
  const theta = thetaParam(timeline.theta0_rad, t, timeline.driver.running);
  const { inView, folded } = splitParams(
    [...(sequence.active ? sequence.params : sliders.params), ...theta],
    visibleKeys(mode, show, sequence.active),
  );
  return (
    <Sliders
      toggle={<ManeuverButtons sequence={sequence} resetAll={timeline.resetAll} t={t} />}
      params={inView}
      folded={folded}
      onChange={(key, value) => {
        if (key === 'theta') timeline.setTheta0(theta0Of(value));
        else if (sequence.change(key, value)) timeline.restart();
        else sliders.onSlider(key, value);
      }}
      onReset={timeline.resetAll}
      feasible={feasible}
      t={t}
    />
  );
}
