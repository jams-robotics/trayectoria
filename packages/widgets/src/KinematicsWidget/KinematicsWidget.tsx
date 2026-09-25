import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { ParamPanel } from '../ParamPanel/ParamPanel';
import { SimLayout } from '../shared/SimLayout';
import { MotionPlots } from './MotionPlots';
import { sampleMotion, tangentSegment, velocityAt } from './compute';
import type { Motion } from './compute';
import { Controls, MotionScene, Values, applyChange, paramsOf } from './panels';
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

/** The stacked charts of the motion, with the shared marker and the optional tangent. */
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

/** The left column: the scene, the playback controls and the charts (docs/DESIGN.md §6). */
function Viewer({
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
  // gap-4 keeps the spacing the single mobile column had before the §6 layout.
  return (
    <div className="flex flex-col gap-4">
      <MotionScene motion={motion} t_s={timeline.t_s} duration_s={duration_s} t={t} />
      <Controls timeline={timeline} />
      <div className="flex min-w-0 flex-col gap-3 overflow-hidden">
        <Charts
          motion={motion}
          timeline={timeline}
          duration_s={duration_s}
          showTangent={showTangent}
          t={t}
        />
      </div>
    </div>
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
      viewer={
        <Viewer
          motion={motion}
          timeline={timeline}
          duration_s={duration_s}
          showTangent={showTangent}
          t={t}
        />
      }
      values={<Values timeline={timeline} motion={motion} showTangent={showTangent} t={t} />}
      params={
        editable.length === 0 ? null : (
          <ParamPanel
            params={paramsOf(motion, editable, t)}
            onChange={(key, value) => {
              setMotion((current) => applyChange(current, key, value));
            }}
          />
        )
      }
    />
  );
}
