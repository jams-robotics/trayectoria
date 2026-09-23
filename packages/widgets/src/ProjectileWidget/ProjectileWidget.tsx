import { useMemo, useState } from 'react';
import type { Dispatch, JSX, SetStateAction } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { SimControls } from '../SimControls/SimControls';
import { LiveStatus } from '../shared/ReadoutPanel';
import { flightTime, range, worldWidthOf } from './compute';
import type { Launch, ProjectileMode } from './compute';
import { LaunchParams, ResultsPanel, applyChange, statusOf } from './panels';
import { ProjectileScene } from './scene';
import type { DrawnLaunch, VectorKind } from './scene';
import { useTimeline } from './timeline';

export type { ProjectileMode } from './compute';
export type { VectorKind } from './scene';

/** Palette token of each drawn launch: the main one and the overlaid one (#88, decision 7). */
const LAUNCH_COLORS: readonly string[] = ['color-data-1', 'color-data-2'];

export interface ProjectileWidgetProps {
  mode: ProjectileMode;
  initial: {
    v0_mps?: number;
    launchAngle_rad?: number;
    h_m: number;
    vRobot_mps?: number;
  };
  /** Adds a second launch with its own sliders, only in `launch` (#88, decision 7). */
  overlay?: boolean;
  /** Velocity arrows drawn at the projectile. Defaults to none. */
  showVectors?: VectorKind[];
  /** Time the widget opens at, in seconds. Defaults to the start of the flight. */
  initialTime_s?: number;
}

/** Fills the optional values of `initial` so `compute.ts` always gets a complete launch. */
function launchOf(initial: ProjectileWidgetProps['initial']): Launch {
  return {
    v0_mps: initial.v0_mps ?? 0,
    launchAngle_rad: initial.launchAngle_rad ?? 0,
    h_m: initial.h_m,
    vRobot_mps: initial.vRobot_mps ?? 0,
  };
}

/** The launches the widget draws and the setter of each one, in draw order. */
interface Launches {
  launches: readonly Launch[];
  setters: readonly [SetLaunch, SetLaunch];
}

/**
 * The editable state of the widget: the main launch and, with an overlay, a second one that
 * starts from the same values and takes its own sliders (#88, decision 7).
 */
function useLaunches(initial: ProjectileWidgetProps['initial'], overlaid: boolean): Launches {
  const [primary, setPrimary] = useState<Launch>(() => launchOf(initial));
  const [secondary, setSecondary] = useState<Launch>(() => launchOf(initial));
  const launches = useMemo(
    () => (overlaid ? [primary, secondary] : [primary]),
    [overlaid, primary, secondary],
  );
  return { launches, setters: [setPrimary, setSecondary] };
}

/** Pairs a launch with the palette token its marks take, by draw order (#88, decision 7). */
function drawnLaunch(launch: Launch, index: number): DrawnLaunch {
  return { launch, color: LAUNCH_COLORS[index] ?? LAUNCH_COLORS[0] ?? 'color-data-1' };
}

/** One launch state setter, so the side panel can edit either of the two drawn launches. */
type SetLaunch = Dispatch<SetStateAction<Launch>>;

/**
 * The right-hand column: the values panel, the live description and one `ParamPanel` per drawn
 * launch. With an overlay each panel carries its `A` or `B` legend (#88, decision 7).
 */
function SidePanel({
  mode,
  launches,
  t_s,
  onChange,
  t,
}: {
  mode: ProjectileMode;
  launches: readonly Launch[];
  t_s: number;
  onChange: readonly [SetLaunch, SetLaunch];
  t: Translate;
}): JSX.Element {
  const overlaid = launches.length > 1;
  const legends = [t('widgets.ProjectileWidget.legendA'), t('widgets.ProjectileWidget.legendB')];
  const primary = launches[0];
  return (
    <div className="flex flex-col gap-4 lg:w-panel">
      <ResultsPanel mode={mode} launches={launches} t_s={t_s} t={t} />
      {primary === undefined ? null : <LiveStatus text={statusOf(mode, primary, t_s, t)} />}
      {launches.map((launch, index) => (
        <LaunchParams
          key={legends[index]}
          mode={mode}
          launch={launch}
          legend={overlaid ? legends[index] : undefined}
          onChange={(key, value) => {
            onChange[index === 0 ? 0 : 1]((current) => applyChange(current, key, value));
          }}
          t={t}
        />
      ))}
    </div>
  );
}

/**
 * Projectile motion, free fall and a part dropped from a moving robot (docs/WIDGETS.md,
 * ProjectileWidget; docs/CURRICULUM.md T-1.3, T-1.4).
 *
 * The playback controls advance a minimal model whose state is the elapsed time and which
 * pauses on landing (#88, decision 3); every position, velocity, range, apex and flight time
 * comes from the closed forms of `compute.ts`, with `g` from `sim-core`. There is no air drag
 * and no bounce (out of scope of #88).
 */
export function ProjectileWidget({
  mode,
  initial,
  overlay = false,
  showVectors = [],
  initialTime_s = 0,
}: ProjectileWidgetProps): JSX.Element {
  const t = useT();
  const { launches, setters } = useLaunches(initial, overlay && mode === 'launch');
  // The flight lasts as long as the longest of the drawn launches, so neither is cut short.
  const flightTime_s = Math.max(...launches.map((launch) => flightTime(mode, launch)));
  const timeline = useTimeline(flightTime_s, initialTime_s);
  const { t_s } = timeline;
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <ProjectileScene
          mode={mode}
          launches={launches.map(drawnLaunch)}
          t_s={t_s}
          worldWidth_m={worldWidthOf(launches.map((launch) => range(mode, launch)))}
          showVectors={showVectors}
          t={t}
        />
        <SimControls {...timeline.driver} {...timeline.controls} t_s={t_s} />
      </div>
      <SidePanel
        mode={mode}
        launches={launches}
        t_s={t_s}
        onChange={setters}
        t={t}
      />
    </div>
  );
}