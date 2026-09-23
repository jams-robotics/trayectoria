import type { JSX } from 'react';
import { format } from '@trayectoria/sim-core';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import { Scene2D } from '../Scene2D/Scene2D';
import { Axes } from '../Scene2D/primitives/Axes';
import { Circle } from '../Scene2D/primitives/Circle';
import { Vector } from '../Scene2D/primitives/Vector';
import { SimControls } from '../SimControls/SimControls';
import { LiveStatus, ReadoutPanel } from '../shared/ReadoutPanel';
import { positionAt, velocityAt, worldWidthOf } from './compute';
import type { Motion } from './compute';
import type { KinematicsEditable, Timeline } from './timeline';

/** Radius of the particle drawn in the scene, in metres of the world. */
const PARTICLE_RADIUS_M = 0.06;
/** Scene metres per m/s, so the velocity arrow stays inside the view. */
const M_PER_MPS = 0.4;
/** Width over height of the scene: a wide strip, since the motion is one-dimensional. */
const SCENE_ASPECT = 6;

/** Sliders of the editable values, with the ranges of T-1.1 and T-1.2 (docs/CURRICULUM.md). */
const RANGES: Readonly<Record<KinematicsEditable, { min: number; max: number; step: number }>> = {
  x0: { min: -2, max: 2, step: 0.1 },
  v0: { min: -1, max: 1, step: 0.1 },
  a: { min: -2, max: 2, step: 0.1 },
};

/** The lines of the panel: `t`, `x`, `v`, `a` and, with `showTangent`, the slope (decision 7). */
export function panelRows(
  motion: Motion,
  t_s: number,
  showTangent: boolean,
  t: Translate,
): ReadonlyArray<readonly [string, string]> {
  const v_mps = velocityAt(motion, t_s);
  const rows: Array<readonly [string, string]> = [
    [t('widgets.KinematicsWidget.time'), format(t_s, t('widgets.KinematicsWidget.unitS'))],
    [
      t('widgets.KinematicsWidget.position'),
      format(positionAt(motion, t_s), t('widgets.KinematicsWidget.unitM')),
    ],
    [t('widgets.KinematicsWidget.velocity'), format(v_mps, t('widgets.KinematicsWidget.unitMps'))],
    [
      t('widgets.KinematicsWidget.accel'),
      format(motion.a_mps2, t('widgets.KinematicsWidget.unitMps2')),
    ],
  ];
  if (showTangent) {
    rows.push([
      t('widgets.KinematicsWidget.slope'),
      format(v_mps, t('widgets.KinematicsWidget.unitMps')),
    ]);
  }
  return rows;
}

/** One sentence with `t`, `x` and `v`, for the `aria-live` region (#87, decision 9). */
export function statusOf(motion: Motion, t_s: number, t: Translate): string {
  return t('widgets.KinematicsWidget.status', {
    time: format(t_s, t('widgets.KinematicsWidget.unitS')),
    position: format(positionAt(motion, t_s), t('widgets.KinematicsWidget.unitM')),
    velocity: format(velocityAt(motion, t_s), t('widgets.KinematicsWidget.unitMps')),
  });
}

/** The sliders of the editable values, translated and in the ranges of the curriculum. */
export function paramsOf(
  motion: Motion,
  editable: readonly KinematicsEditable[],
  t: Translate,
): readonly ParamPanelParam[] {
  const values: Record<KinematicsEditable, { value: number; unit: string }> = {
    x0: { value: motion.x0_m, unit: t('widgets.KinematicsWidget.unitM') },
    v0: { value: motion.v0_mps, unit: t('widgets.KinematicsWidget.unitMps') },
    a: { value: motion.a_mps2, unit: t('widgets.KinematicsWidget.unitMps2') },
  };
  return editable.map((key) => ({
    key,
    label: t(`widgets.KinematicsWidget.param${key}`),
    unit: values[key].unit,
    value: values[key].value,
    ...RANGES[key],
  }));
}

/** Applies one slider change to the motion. */
export function applyChange(motion: Motion, key: string, value: number): Motion {
  if (key === 'x0') return { ...motion, x0_m: value };
  if (key === 'v0') return { ...motion, v0_mps: value };
  if (key === 'a') return { ...motion, a_mps2: value };
  return motion;
}

/** The particle on its axis, with the velocity arrow over it (#87, decision 6). */
export function MotionScene({
  motion,
  t_s,
  duration_s,
  t,
}: {
  motion: Motion;
  t_s: number;
  duration_s: number;
  t: Translate;
}): JSX.Element {
  const x_m = positionAt(motion, t_s);
  const v_mps = velocityAt(motion, t_s);
  const worldWidth_m = worldWidthOf(motion, duration_s);
  return (
    <Scene2D
      worldWidth_m={worldWidth_m}
      center_m={[worldWidth_m / 2, 0]}
      aspect={SCENE_ASPECT}
      description={t('widgets.KinematicsWidget.scene')}
    >
      <Axes />
      <Circle center_m={[x_m, 0]} radius_m={PARTICLE_RADIUS_M} color="sim-robot" filled />
      <Vector
        from_m={[x_m, 0]}
        to_m={[x_m + v_mps * M_PER_MPS, 0]}
        label={t('widgets.KinematicsWidget.vectorV')}
      />
    </Scene2D>
  );
}

/** The right-hand column: playback controls, values panel, live status and the sliders. */
export function SidePanel({
  timeline,
  motion,
  editable,
  showTangent,
  onChange,
  t,
}: {
  timeline: Timeline;
  motion: Motion;
  editable: readonly KinematicsEditable[];
  showTangent: boolean;
  onChange: (key: string, value: number) => void;
  t: Translate;
}): JSX.Element {
  const { t_s } = timeline;
  return (
    <div className="flex flex-col gap-4 lg:w-panel">
      <SimControls {...timeline.driver} {...timeline.controls} t_s={t_s} />
      <ReadoutPanel
        title={t('widgets.KinematicsWidget.panel')}
        rows={panelRows(motion, t_s, showTangent, t)}
      />
      <LiveStatus text={statusOf(motion, t_s, t)} />
      {editable.length === 0 ? null : (
        <ParamPanel params={paramsOf(motion, editable, t)} onChange={onChange} />
      )}
    </div>
  );
}
