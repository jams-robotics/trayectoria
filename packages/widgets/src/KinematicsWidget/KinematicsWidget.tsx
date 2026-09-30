import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import { SimControls } from '../SimControls/SimControls';
import { SimLayout } from '../shared/SimLayout';
import { MotionPlots } from './MotionPlots';
import { sampleMotion, tangentSegment, velocityAt } from './compute';
import type { Motion } from './compute';
import { MotionScene, Values, applyChange, paramsOf } from './panels';
import { useTimeline } from './timeline';
import type { KinematicsEditable, Timeline } from './timeline';

export type { KinematicsEditable } from './timeline';

export interface KinematicsWidgetProps {
  initial: Motion;
  editable: KinematicsEditable[];
  duration_s: number;
  /** Draws the tangent to `x(t)` and shows its slope (T-0.3). Defaults to false. */
  showTangent?: boolean;
  /** Time the marker starts at, in seconds. Defaults to the start of the motion. */
  initialTime_s?: number;
}

/** The three charts of the motion, with the shared marker and the optional tangent. */
function Charts({
  motion,
  timeline,
  duration_s,
  showTangent,
  t,
}: {
  motion: Motion;
  timeline: Timeline;
  duration_s: number;
  showTangent: boolean;
  t: Translate;
}): JSX.Element {
  const { t_s } = timeline;
  const samples = useMemo(() => sampleMotion(motion, duration_s), [motion, duration_s]);
  const tangent = useMemo(
    () => (showTangent ? tangentSegment(motion, t_s, duration_s) : undefined),
    [showTangent, motion, t_s, duration_s],
  );
  return (
    <MotionPlots
      samples={samples}
      marker={{ x: t_s, onDrag: timeline.onDrag }}
      tangent={tangent}
      slope_mps={velocityAt(motion, t_s)}
      t={t}
    />
  );
}

/**
 * The charts as an extra of the layout: full width under the sliders and, from the breakpoint,
 * the three in one row; stacked in the mobile column (docs/DESIGN.md §6, #544).
 */
function ChartsExtra(props: Parameters<typeof Charts>[0]): JSX.Element {
  return (
    <div className="grid min-w-0 gap-3 overflow-hidden lg:grid-cols-3" data-kinematics-charts="">
      <Charts {...props} />
    </div>
  );
}

// From the breakpoint the single panel spans both columns of the parameters and lays its sliders
// out in one row, so every block of the widget shares the same width (docs/DESIGN.md §6, #544).
const PARAMS_FULL_WIDTH =
  'min-w-0 lg:col-span-2 lg:[&_[data-layout=stack]>div]:flex-row lg:[&_[data-layout=stack]>div]:gap-6';

/** The viewer: the scene and, under it, the playback controls (docs/DESIGN.md §6). */
function Viewer({
  motion,
  timeline,
  duration_s,
  t,
}: {
  motion: Motion;
  timeline: Timeline;
  duration_s: number;
  t: Translate;
}): JSX.Element {
  return (
    <>
      <MotionScene motion={motion} t_s={timeline.t_s} duration_s={duration_s} t={t} />
      <SimControls {...timeline.driver} {...timeline.controls} t_s={timeline.t_s} />
    </>
  );
}

/**
 * 1D particle with its `x–t`, `v–t` and `a–t` charts synchronised and a tangent mode
 * (docs/WIDGETS.md, KinematicsWidget; docs/CURRICULUM.md T-0.3, T-1.1, T-1.2).
 *
 * The playback controls advance a minimal model whose state is the elapsed time (#87, decision
 * 3); every position, velocity and acceleration comes from the closed forms of `compute.ts`.
 * The three charts share the marker: dragging it fixes `t` and pauses the playback.
 */
export function KinematicsWidget({
  initial,
  editable,
  duration_s,
  showTangent = false,
  initialTime_s = 0,
}: KinematicsWidgetProps): JSX.Element {
  const t = useT();
  const [motion, setMotion] = useState<Motion>(initial);
  const timeline = useTimeline(duration_s, initialTime_s);
  return (
    <SimLayout
      viewer={<Viewer motion={motion} timeline={timeline} duration_s={duration_s} t={t} />}
      values={<Values timeline={timeline} motion={motion} showTangent={showTangent} t={t} />}
      params={
        editable.length === 0 ? null : (
          <div className={PARAMS_FULL_WIDTH}>
            <ParamPanel
              params={paramsOf(motion, editable, t)}
              onChange={(key, value) => {
                setMotion((current) => applyChange(current, key, value));
              }}
            />
          </div>
        )
      }
      extras={[
        {
          key: 'charts',
          mobile: 'afterViewerFirst',
          node: <ChartsExtra {...{ motion, timeline, duration_s, showTangent, t }} />,
        },
      ]}
    />
  );
}
