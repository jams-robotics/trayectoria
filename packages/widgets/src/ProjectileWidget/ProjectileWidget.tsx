import { useMemo, useState } from 'react';
import type { Dispatch, JSX, SetStateAction } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { SimControls } from '../SimControls/SimControls';
import { LiveStatus } from '../shared/ReadoutPanel';
import { flightTime, range, worldWidthOf } from './compute';
import type { Launch, ProjectileMode } from './compute';
import { ModeToggle } from './ModeToggle';
import { LaunchParams, ResultsPanel, applyChange, statusOf } from './panels';
import { ProjectileScene } from './scene';
import type { DrawnLaunch, VectorKind } from './scene';
import { useTimeline } from './timeline';

export type { ProjectileMode } from './compute';
export type { VectorKind } from './scene';

/** Palette token of each drawn launch: the main one and the overlaid one (#88, decision 7). */
const LAUNCH_COLORS: readonly string[] = ['color-data-1', 'color-data-2'];
/** Modes where `overlay` draws a second launch or drop (#88, decision 7; #304). */
const OVERLAY_MODES: readonly ProjectileMode[] = ['launch', 'drop'];
/** Height of the overlaid drop B over that of A: its fall time and impact speed double (#304). */
const OVERLAY_DROP_HEIGHT_FACTOR = 4;

export interface ProjectileWidgetProps {
  /** Mode the widget opens in. */
  mode: ProjectileMode;
  /** With more than one, a segmented selector switches between them (#304). */
  modes?: ProjectileMode[];
  initial: {
    v0_mps?: number;
    launchAngle_rad?: number;
    h_m: number;
    vRobot_mps?: number;
  };
  /** Adds a second launch or drop with its own sliders, in `launch` and `drop` (#88; #304). */
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

/**
 * Where the overlaid launch starts from: the same values as A in `launch` (#88, decision 7)
 * and four times its height in `drop` (#304).
 */
function overlaidOf(mode: ProjectileMode, launch: Launch): Launch {
  return mode === 'drop' ? { ...launch, h_m: launch.h_m * OVERLAY_DROP_HEIGHT_FACTOR } : launch;
}

/** One launch state setter, so the side panel can edit either of the two drawn launches. */
type SetLaunch = Dispatch<SetStateAction<Launch>>;

/** The launches the widget draws and the setter of each one, in draw order. */
interface Launches {
  launches: readonly Launch[];
  setters: readonly [SetLaunch, SetLaunch];
  /** Starts the overlaid launch again from A, as `overlaidOf` sets it for `mode`. */
  restartOverlay: (mode: ProjectileMode) => void;
}

/**
 * The editable state of the widget: the main launch and, with an overlay, a second one that
 * starts from `overlaidOf` and takes its own sliders (#88, decision 7; #304).
 */
function useLaunches(
  initial: ProjectileWidgetProps['initial'],
  mode: ProjectileMode,
  overlay: boolean,
): Launches {
  const [primary, setPrimary] = useState<Launch>(() => launchOf(initial));
  const [secondary, setSecondary] = useState<Launch>(() => overlaidOf(mode, launchOf(initial)));
  const overlaid = overlay && OVERLAY_MODES.includes(mode);
  const launches = useMemo(
    () => (overlaid ? [primary, secondary] : [primary]),
    [overlaid, primary, secondary],
  );
  return {
    launches,
    setters: [setPrimary, setSecondary],
    restartOverlay: (next) => {
      setSecondary(overlaidOf(next, primary));
    },
  };
}

/** Pairs a launch with the palette token its marks take, by draw order (#88, decision 7). */
function drawnLaunch(launch: Launch, index: number): DrawnLaunch {
  return { launch, color: LAUNCH_COLORS[index] ?? LAUNCH_COLORS[0] ?? 'color-data-1' };
}

/** The `A` and `B` legends of the mode: two launches, or two drops in `drop` (#304). */
function legendsOf(mode: ProjectileMode, t: Translate): readonly [string, string] {
  return mode === 'drop'
    ? [t('widgets.ProjectileWidget.legendDropA'), t('widgets.ProjectileWidget.legendDropB')]
    : [t('widgets.ProjectileWidget.legendA'), t('widgets.ProjectileWidget.legendB')];
}

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
  const legends = legendsOf(mode, t);
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

/** What `ProjectileView` draws: one mode and its launches. */
interface ProjectileViewProps {
  mode: ProjectileMode;
  launches: readonly Launch[];
  setters: readonly [SetLaunch, SetLaunch];
  showVectors: VectorKind[];
  initialTime_s: number;
  t: Translate;
}

/**
 * The scene, the playback controls and the side panel of one mode. It owns the time, so the
 * widget mounts it again on each mode change and the simulation restarts paused at `t = 0`
 * (#304).
 */
function ProjectileView({
  mode,
  launches,
  setters,
  showVectors,
  initialTime_s,
  t,
}: ProjectileViewProps): JSX.Element {
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
      <SidePanel mode={mode} launches={launches} t_s={t_s} onChange={setters} t={t} />
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
 *
 * With more than one of `modes`, a selector switches the mode: the simulation restarts paused
 * at `t = 0` and the launch keeps its values, `h` among them (#304).
 */
export function ProjectileWidget({
  mode: initialMode,
  modes = [],
  initial,
  overlay = false,
  showVectors = [],
  initialTime_s = 0,
}: ProjectileWidgetProps): JSX.Element {
  const t = useT();
  const [mode, setMode] = useState(initialMode);
  // `initialTime_s` opens the first mode only: a mode switched to starts at `t = 0` (#304).
  const [switched, setSwitched] = useState(false);
  const { launches, setters, restartOverlay } = useLaunches(initial, mode, overlay);
  const selectMode = (next: ProjectileMode): void => {
    if (next === mode) return;
    setMode(next);
    setSwitched(true);
    restartOverlay(next);
  };
  const view = (
    <ProjectileView
      key={mode}
      mode={mode}
      launches={launches}
      setters={setters}
      showVectors={showVectors}
      initialTime_s={switched ? 0 : initialTime_s}
      t={t}
    />
  );
  // Without a choice of modes the widget keeps its markup as it was before #304. The selector
  // sits outside the remounted view, so it keeps the keyboard focus across a switch.
  if (modes.length <= 1) return view;
  return (
    <div className="flex flex-col gap-3">
      <ModeToggle modes={modes} value={mode} onChange={selectMode} t={t} />
      {view}
    </div>
  );
}
