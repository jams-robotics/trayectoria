import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import { MANEUVER_DISTANCE_RANGE_M, MANEUVER_TURN_RANGE_DEG } from './maneuver';
import { Notice } from './panels';
import type { ManeuverControls } from './useManeuver';

// Chip version of the segmented control of docs/DESIGN.md §5: container with a `border` and
// `sm` radius, active in `primary` over `primary-fg`.
const CHIP = 'h-10 px-3 font-mono text-sm font-semibold transition-colors duration-[120ms]';
const ACTIVE = `${CHIP} bg-primary text-primary-fg`;
const INACTIVE = `${CHIP} text-fg-muted hover:text-fg`;

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

/** The «Maniobra en tres movimientos» switch: a single chip with `aria-pressed` (#394). */
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
    <div className="border-border flex w-fit overflow-hidden rounded-sm border">
      <button
        type="button"
        className={active ? ACTIVE : INACTIVE}
        aria-pressed={active}
        onClick={onToggle}
      >
        {t('widgets.DiffDriveWidget.toggleManeuver')}
      </button>
    </div>
  );
}

/**
 * The sliders of the mode, with the maneuver switch (when there is one) and the saturation
 * notice above them (#92, decision 4; #394).
 */
export function Sliders({
  toggle,
  params,
  onChange,
  feasible,
  t,
}: {
  toggle: JSX.Element | null;
  params: readonly ParamPanelParam[];
  onChange: (key: string, value: number) => void;
  feasible: boolean;
  t: Translate;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {toggle}
      {feasible ? null : <Notice text={t('widgets.DiffDriveWidget.saturated')} tone="error" />}
      <ParamPanel params={params} onChange={onChange} />
    </div>
  );
}

/**
 * The sliders of the mode or, with the maneuver on, its «Giro» and «Avance»; the switch sits
 * above them and every change of the maneuver restarts the run (#394).
 */
export function ModeSliders({
  sliders,
  sequence,
  timeline,
  feasible,
  t,
}: {
  sliders: {
    params: readonly ParamPanelParam[];
    onSlider: (key: string, value: number) => void;
  };
  sequence: ManeuverControls;
  timeline: { restart: () => void };
  feasible: boolean;
  t: Translate;
}): JSX.Element {
  const toggle = (): void => {
    sequence.toggle();
    timeline.restart();
  };
  return (
    <Sliders
      toggle={
        sequence.available ? (
          <ManeuverToggle active={sequence.active} onToggle={toggle} t={t} />
        ) : null
      }
      params={sequence.active ? sequence.params : sliders.params}
      onChange={(key, value) => {
        if (sequence.change(key, value)) timeline.restart();
        else sliders.onSlider(key, value);
      }}
      feasible={feasible}
      t={t}
    />
  );
}
