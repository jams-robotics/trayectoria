import type { JSX } from 'react';
import { degToRad, format, radToDeg } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import { ReadoutPanel } from '../shared/ReadoutPanel';
import type { ReadoutRow } from '../shared/ReadoutPanel';
import { flightTime, maxHeight, positionAt, range, velocityAt } from './compute';
import type { Launch, ProjectileMode } from './compute';

/** Which value of the launch a slider edits (#88, decision 6). */
export type ProjectileParam = 'v0' | 'angle' | 'h' | 'vRobot';

/** Slider ranges of decision 6 of #88; the angle is edited in degrees. */
const RANGES: Readonly<Record<ProjectileParam, { min: number; max: number; step: number }>> = {
  v0: { min: 0.5, max: 8, step: 0.1 },
  angle: { min: 0, max: 90, step: 1 },
  h: { min: 0, max: 2, step: 0.05 },
  vRobot: { min: 0, max: 1, step: 0.05 },
};

/** Values the learner may edit in each mode (#88, decision 6). */
const EDITABLE: Readonly<Record<ProjectileMode, readonly ProjectileParam[]>> = {
  launch: ['v0', 'angle', 'h'],
  drop: ['h'],
  dropFromRobot: ['vRobot', 'h'],
};

/** The sliders of the mode, translated, with the angle shown in degrees (#88, decision 6). */
export function paramsOf(
  mode: ProjectileMode,
  launch: Launch,
  t: Translate,
): readonly ParamPanelParam[] {
  const values: Record<ProjectileParam, { value: number; unit: string }> = {
    v0: { value: launch.v0_mps, unit: t('widgets.ProjectileWidget.unitMps') },
    angle: {
      value: Number(radToDeg(launch.launchAngle_rad).toFixed(1)),
      unit: t('widgets.ProjectileWidget.unitDeg'),
    },
    h: { value: launch.h_m, unit: t('widgets.ProjectileWidget.unitM') },
    vRobot: { value: launch.vRobot_mps, unit: t('widgets.ProjectileWidget.unitMps') },
  };
  return EDITABLE[mode].map((key) => ({
    key,
    label: t(`widgets.ProjectileWidget.param${key}`),
    unit: values[key].unit,
    value: values[key].value,
    ...RANGES[key],
  }));
}

/** Applies one slider change to the launch; the angle arrives in degrees (#88, decision 6). */
export function applyChange(launch: Launch, key: string, value: number): Launch {
  if (key === 'v0') return { ...launch, v0_mps: value };
  if (key === 'angle') return { ...launch, launchAngle_rad: degToRad(value) };
  if (key === 'h') return { ...launch, h_m: value };
  if (key === 'vRobot') return { ...launch, vRobot_mps: value };
  return launch;
}

/** The results and live values of one launch, already formatted (#88, decision 8). */
export function readoutValues(
  mode: ProjectileMode,
  launch: Launch,
  t_s: number,
  t: Translate,
): readonly string[] {
  const unitM = t('widgets.ProjectileWidget.unitM');
  const unitMps = t('widgets.ProjectileWidget.unitMps');
  const [x_m, y_m] = positionAt(mode, launch, t_s);
  const [vx_mps, vy_mps] = velocityAt(mode, launch, t_s);
  return [
    format(range(mode, launch), unitM),
    format(maxHeight(mode, launch), unitM),
    format(flightTime(mode, launch), t('widgets.ProjectileWidget.unitS')),
    format(t_s, t('widgets.ProjectileWidget.unitS')),
    format(x_m, unitM),
    format(y_m, unitM),
    format(vx_mps, unitMps),
    format(vy_mps, unitMps),
  ];
}

/** The term of each line of the panel, in the order `readoutValues` returns them. */
function readoutTerms(t: Translate): readonly string[] {
  return [
    t('widgets.ProjectileWidget.range'),
    t('widgets.ProjectileWidget.maxHeight'),
    t('widgets.ProjectileWidget.flightTime'),
    t('widgets.ProjectileWidget.time'),
    t('widgets.ProjectileWidget.x'),
    t('widgets.ProjectileWidget.y'),
    t('widgets.ProjectileWidget.vx'),
    t('widgets.ProjectileWidget.vy'),
  ];
}

/** The lines of the panel: one column, or `A / B` when a second launch is overlaid (decision 7). */
export function panelRows(
  mode: ProjectileMode,
  launches: readonly Launch[],
  t_s: number,
  t: Translate,
): readonly ReadoutRow[] {
  const columns = launches.map((launch) => readoutValues(mode, launch, t_s, t));
  const separator = t('widgets.ProjectileWidget.columnSeparator');
  return readoutTerms(t).map((term, line) => [
    term,
    columns.map((values) => values[line] ?? '').join(separator),
  ]);
}

/** One sentence with `t`, `x` and `y`, for the `aria-live` region (#88, decision 10). */
export function statusOf(
  mode: ProjectileMode,
  launch: Launch,
  t_s: number,
  t: Translate,
): string {
  const [x_m, y_m] = positionAt(mode, launch, t_s);
  return t('widgets.ProjectileWidget.status', {
    time: format(t_s, t('widgets.ProjectileWidget.unitS')),
    x: format(x_m, t('widgets.ProjectileWidget.unitM')),
    y: format(y_m, t('widgets.ProjectileWidget.unitM')),
  });
}

/** The values panel, titled `A / B` when a second launch is overlaid (#88, decision 7). */
export function ResultsPanel({
  mode,
  launches,
  t_s,
  t,
}: {
  mode: ProjectileMode;
  launches: readonly Launch[];
  t_s: number;
  t: Translate;
}): JSX.Element {
  const title =
    launches.length > 1
      ? t('widgets.ProjectileWidget.panelOverlay')
      : t('widgets.ProjectileWidget.panel');
  return <ReadoutPanel title={title} rows={panelRows(mode, launches, t_s, t)} />;
}

/** The sliders of one launch, labelled `A` or `B` when there are two (#88, decision 7). */
export function LaunchParams({
  mode,
  launch,
  legend,
  onChange,
  t,
}: {
  mode: ProjectileMode;
  launch: Launch;
  legend: string | undefined;
  onChange: (key: string, value: number) => void;
  t: Translate;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      {legend === undefined ? null : (
        <p className="text-fg-muted font-mono text-xs tracking-[0.06em] uppercase">{legend}</p>
      )}
      <ParamPanel params={paramsOf(mode, launch, t)} onChange={onChange} />
    </div>
  );
}
