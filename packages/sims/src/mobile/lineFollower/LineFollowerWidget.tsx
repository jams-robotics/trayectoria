import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { parseTrack, presets } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { useMyRobot } from '@trayectoria/widgets';

import { ControllerPanel } from './ControllerPanel';
import { CONTROLLERS, isControllerId } from './controllers';
import type { ControllerId, ControllerParams } from './controllers';
import { LineFollowerView } from './LineFollowerView';
import { useLineFollower } from './useLineFollower';

/** Preset names the widget accepts, as `docs/WIDGETS.md` spells them. */
export type TrackPreset = 'oval' | 's' | 'tight' | 'cross';

/**
 * A track given as data: the serialized JSON of `parseTrack` (F1-04) or a `Track` already
 * parsed, which is what an editor of F4-01 hands over without a round trip through a string.
 */
export type TrackJson = string | Track;

/** Plots `showPlots` may ask for; drawn from F4-03 on (docs/WIDGETS.md). */
export type LineFollowerPlot = 'error' | 'v' | 'omega' | 'pid';

const PRESET_TRACKS: Readonly<Record<TrackPreset, Track>> = {
  oval: presets.oval,
  s: presets.sCurve,
  tight: presets.tightCurves,
  cross: presets.crossing,
};

function isPreset(track: LineFollowerWidgetProps['track']): track is TrackPreset {
  return typeof track === 'string' && Object.hasOwn(PRESET_TRACKS, track);
}

/**
 * The track the widget simulates. A preset name resolves to the track of sim-core, a string is
 * parsed with `parseTrack` and an object is taken as it is; a string that does not parse falls
 * back to the oval rather than leaving the widget without a track.
 */
export function resolveTrack(track: LineFollowerWidgetProps['track']): Track {
  if (isPreset(track)) return PRESET_TRACKS[track];
  if (typeof track !== 'string') return track;
  const result = parseTrack(track);
  return result.ok ? result.value : presets.oval;
}

/** Which controller drives the run and with which gains; a new tab resets them to its defaults. */
function useControllerChoice(
  controller: LineFollowerWidgetProps['controller'],
  initialParams: ControllerParams,
): {
  selected: ControllerId;
  params: ControllerParams;
  onController: (id: ControllerId) => void;
  onParam: (key: string, value: number) => void;
} {
  const [selected, setSelected] = useState<ControllerId>(() =>
    isControllerId(controller) ? controller : 'pid',
  );
  const [params, setParams] = useState<ControllerParams>(() => ({
    ...CONTROLLERS[controller].defaults,
    ...initialParams,
  }));
  return {
    selected,
    params,
    onController: (id) => {
      setSelected(id);
      setParams({ ...CONTROLLERS[id].defaults });
    },
    onParam: (key, value) => {
      setParams((current) => ({ ...current, [key]: value }));
    },
  };
}

/** The right-hand column: the controller selector and its sliders. */
function Panel({
  spec,
  controller,
  params,
  onController,
  onParam,
}: {
  spec: RobotSpec;
  controller: ControllerId;
  params: ControllerParams;
  onController: (id: ControllerId) => void;
  onParam: (key: string, value: number) => void;
}): JSX.Element | null {
  const { mobile } = spec;
  if (mobile === undefined) return null;
  return (
    <div className="flex flex-col gap-4 lg:w-80">
      <ControllerPanel
        controller={controller}
        params={params}
        spec={mobile}
        onController={onController}
        onParam={onParam}
      />
    </div>
  );
}

export interface LineFollowerWidgetProps {
  /**
   * Preset of sim-core, serialized track or `Track` (docs/WIDGETS.md). `TrackJson` already
   * admits any string, so a preset name is one of its values rather than a separate arm.
   */
  track: TrackJson;
  /** Controller the widget opens on; every tab of the selector stays reachable. */
  controller: 'onoff' | 'p' | 'pid';
  /** Starting value of the sliders; whatever it omits comes from the controller defaults. */
  initialParams: ControllerParams;
  /** Robot simulated; «Mi robot» of the learner when it is not given. */
  robot?: RobotSpec;
  /** Hides the controller panel and the legend, for an embedded viewer. */
  compact?: boolean;
  /**
   * Plots to draw beside the viewer. Accepted so the content can already declare them, but it
   * has no effect until F4-03 adds the charts (fuera de alcance de #127).
   */
  showPlots?: LineFollowerPlot[];
  /** Standard deviation of the sensor noise; without it the readings are exact. */
  noiseSigma?: number;
}

/**
 * The line-following simulator (docs/WIDGETS.md, LineFollowerWidget): a track, a robot driven by
 * the controller the learner picks, the viewer of `docs/DESIGN.md` §6 and the playback controls.
 * It is the same component the page `/simuladores/movil` will embed with `compact` (F4-02b).
 *
 * Changing the controller or a gain restarts the run at `t = 0`: the state the model produced
 * belongs to the controller that produced it, so splicing a new one into it halfway would show
 * numbers no run ever went through.
 */
export function LineFollowerWidget({
  track,
  controller,
  initialParams,
  robot,
  compact = false,
  noiseSigma,
}: LineFollowerWidgetProps): JSX.Element {
  // «Mi robot» is the default, so a saved change reaches the simulator with no reload; an
  // explicit `robot` still wins, which is what the stories use.
  const myRobot = useMyRobot();
  const spec = robot ?? myRobot;
  const resolved = useMemo(() => resolveTrack(track), [track]);
  const choice = useControllerChoice(controller, initialParams);

  const api = useLineFollower({
    spec,
    track: resolved,
    controller: choice.selected,
    params: choice.params,
    ...(noiseSigma === undefined ? {} : { noiseSigma }),
  });

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start" data-testid="line-follower">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <LineFollowerView api={api} spec={spec} track={resolved} compact={compact} />
      </div>
      {compact ? null : (
        <Panel
          spec={spec}
          controller={choice.selected}
          params={choice.params}
          onController={choice.onController}
          onParam={choice.onParam}
        />
      )}
    </div>
  );
}
