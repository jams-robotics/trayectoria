import { useRef } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import { maxWheelSpeed_radps } from '@trayectoria/sim-core';
import type { MobileSpec, RobotSpec } from '@trayectoria/robot-spec';
import { useMyRobot } from '@trayectoria/widgets';

import { ARENA_TRACKS } from './arenaTracks';
import { ArenaPanel } from './ArenaPanel';
import { Brand, PlaybackBar, TopBar, VideoTools } from './ArenaBars';
import type { ArenaStatus, TopBarProps } from './ArenaBars';
import { HUD_CARD, LapBoard, SensorPanel } from './ArenaHud';
import { useArenaKeys, useChallengeCheck, useRecorder } from './arenaHooks';
import { ChallengeBanner, ChallengeCelebration, Tag } from './ArenaParts';
import { DuoLayer, duoOverlay } from './DuoHud';
import { DuoPanel } from './DuoPanel';
import { FreeLayer, freeOverlay } from './FreeHud';
import { FreePanel } from './FreePanel';
import { KICK_RAD } from './race';
import type { Overlay } from './recorder';
import { TelemetryChart } from './TelemetryChart';
import { useArenaLoop } from './useArenaLoop';
import type { ArenaLoop, ArenaRefs } from './useArenaLoop';
import { useArenaSettings } from './useArenaSettings';
import { ANY_KEYS, ARROW_KEYS, WASD_KEYS, useFreeDrive } from './useFreeDrive';
import type { FreeDriveApi } from './useFreeDrive';
import type { ArenaSettings, ArenaSettingsApi } from './useArenaSettings';
import { useManualDrive } from './useManualDrive';

export interface ArenaProps {
  /** Where «Editar mi robot» goes. */
  readonly robotHref: string;
  /** Robot to simulate; «Mi robot» of the learner when it is not given. */
  readonly robot?: RobotSpec;
}

function statusOf(loop: ArenaLoop, settings: ArenaSettings): ArenaStatus {
  if (loop.snapshot?.you.derailed === true) return 'derailed';
  if (!loop.running) return 'paused';
  if (settings.players === 2) return 'duo';
  return settings.controller === 'manual' ? 'manual' : 'running';
}

function overlayOf(t: Translate, loop: ArenaLoop, settings: ArenaSettings): Overlay {
  const duo = loop.snapshot?.duo;
  if (duo !== undefined && duo !== null) return duoOverlay(t, duo);
  const free = loop.snapshot?.free;
  if (free !== undefined && free !== null) return freeOverlay(t, free);
  const you = loop.snapshot?.you;
  const lap_s = you === undefined ? 0 : you.state.robot.t_s - you.state.lapStart_s;
  const best = you === undefined || you.laps_s.length === 0 ? null : Math.min(...you.laps_s);
  return {
    title: `${t('sims.arena.brand')} · ${t(`sims.arena.controller.${settings.controller}`)}`,
    lines: [
      `${t('sims.arena.hud.lapTime')}  ${lap_s.toFixed(2)} s`,
      `${t('sims.arena.hud.best')}  ${best === null ? '—' : `${best.toFixed(2)} s`}`,
      `${t('sims.arena.hud.laps')}  ${you?.laps_s.length ?? 0}`,
    ],
    footer: 'trayectoria.org',
  };
}

function useArena(robot: RobotSpec | undefined) {
  const myRobot = useMyRobot();
  const spec = robot ?? myRobot;
  const mobile: MobileSpec | undefined = spec.mobile;
  if (mobile === undefined)
    throw new Error('La pista 3D requiere un robot con perfil «mobile-diff»');
  const api = useArenaSettings();
  const isFree = api.settings.free;
  const isDuo = api.settings.players === 2;
  const drive = useManualDrive(mobile, api.settings.controller === 'manual' && !isFree && !isDuo);
  // Two players: player 1 on WASD, player 2 on the arrows, both held-key drives of the free arena.
  const free = useFreeDrive(mobile, isFree || isDuo, isDuo ? WASD_KEYS : ANY_KEYS);
  const second = useFreeDrive(mobile, isDuo, ARROW_KEYS);
  const refs: ArenaRefs = {
    root: useRef<HTMLDivElement | null>(null),
    canvas: useRef<HTMLCanvasElement | null>(null),
    youTag: useRef<HTMLDivElement | null>(null),
    ghostTag: useRef<HTMLDivElement | null>(null),
  };
  const loop = useArenaLoop(refs, {
    spec,
    track: ARENA_TRACKS[api.settings.track],
    settings: api.settings,
    command: isFree || isDuo ? free.command : drive.command,
    command2: second.command,
  });
  useArenaKeys(loop, api);
  const challenges = useChallengeCheck(loop.snapshot, api);
  return { mobile, api, drive, free, refs, loop, challenges };
}

/** What the top bar shows and does: status, camera, recording and fullscreen. */
function useTopBar(refs: ArenaRefs, loop: ArenaLoop, api: ArenaSettingsApi): TopBarProps {
  const t = useT();
  const { settings } = api;
  const recorder = useRecorder(refs.canvas, () => overlayOf(t, loop, settings));
  return {
    status: statusOf(loop, settings),
    camera: settings.camera,
    onCamera: (camera: ArenaSettings['camera']) => api.update({ camera }),
    recording: recorder.recording,
    canRecord: recorder.supported,
    vertical: recorder.vertical,
    onVertical: recorder.setVertical,
    onRecord: recorder.toggle,
    onFullscreen: () => void refs.root.current?.requestFullscreen(),
    free: settings.free,
  };
}

/** Start, restart, kick and speed, centred under the canvas. */
function Playback({ loop, api }: { loop: ArenaLoop; api: ArenaSettingsApi }): JSX.Element {
  return (
    <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center px-3 lg:bottom-4">
      <PlaybackBar
        running={loop.running}
        speed={api.settings.speed}
        onToggle={() => loop.setRunning(!loop.running)}
        onReset={() => loop.reset()}
        onKick={() => loop.kick(KICK_RAD)}
        onSpeed={(speed) => api.update({ speed })}
      />
    </div>
  );
}

/** What floats over the canvas besides the top bar: the free arena's board and pad, or the track's banner. */
function StageOverlays({
  loop,
  api,
  free,
}: {
  loop: ArenaLoop;
  api: ArenaSettingsApi;
  free: FreeDriveApi;
}): JSX.Element {
  if (api.settings.players === 2)
    return (
      <DuoLayer progress={loop.snapshot?.duo ?? null} drive={free} onRestart={() => loop.reset()} />
    );
  if (api.settings.free)
    return (
      <FreeLayer
        progress={loop.snapshot?.free ?? null}
        drive={free}
        onRestart={() => loop.reset()}
      />
    );
  return (
    <>
      <ChallengeBanner settings={api.settings} />
      <Playback loop={loop} api={api} />
    </>
  );
}

/** The canvas with the name tags and the bars floating over it. */
function ArenaStage({
  refs,
  loop,
  api,
  bar,
  free,
}: {
  refs: ArenaRefs;
  loop: ArenaLoop;
  api: ArenaSettingsApi;
  bar: TopBarProps;
  free: FreeDriveApi;
}): JSX.Element {
  const t = useT();
  const duo = api.settings.players === 2;
  return (
    <div className="relative h-[64dvh] lg:absolute lg:inset-0 lg:h-auto">
      <canvas
        ref={refs.canvas}
        className="block h-full w-full touch-none"
        aria-label={t('sims.arenaPage.lead')}
      />
      <Tag
        tagRef={refs.youTag}
        label={duo ? t('sims.arena.duo.player', { n: 1 }) : t('sims.arena.you')}
        className="bg-physical text-physical-fg"
      />
      <Tag
        tagRef={refs.ghostTag}
        label={duo ? t('sims.arena.duo.player', { n: 2 }) : t('sims.arena.reference')}
        className="bg-primary text-primary-fg"
      />
      <TopBar {...bar} />
      <StageOverlays loop={loop} api={api} free={free} />
    </div>
  );
}

/** Lap board, sensors and telemetry; hidden in cinema. */
function HudAside({
  cinema,
  loop,
  mobile,
}: {
  cinema: boolean;
  loop: ArenaLoop;
  mobile: MobileSpec;
}): JSX.Element {
  return (
    <aside
      className={`${cinema ? 'hidden' : 'flex'} flex-col gap-3 px-3 lg:absolute lg:right-4 lg:top-12 lg:bottom-12 lg:w-panel lg:overflow-y-auto lg:px-0`}
    >
      {loop.snapshot === null ? null : (
        <LapBoard you={loop.snapshot.you} ghost={loop.snapshot.ghost} />
      )}
      {loop.snapshot === null ? null : <SensorPanel you={loop.snapshot.you} />}
      <div className={HUD_CARD}>
        <TelemetryChart telemetry={loop.telemetry} max_radps={maxWheelSpeed_radps(mobile)} />
      </div>
    </aside>
  );
}

type ArenaState = ReturnType<typeof useArena>;

/** The left panel of the free arena and of a two-player race; the track has its own panels. */
function SidePanels({
  state,
  cinema,
  robotHref,
}: {
  state: ArenaState;
  cinema: boolean;
  robotHref: string;
}): JSX.Element {
  const { api, loop } = state;
  const duo = api.settings.players === 2;
  if (!duo && !api.settings.free)
    return <TrackPanels state={state} cinema={cinema} robotHref={robotHref} />;
  return (
    <aside
      className={`${cinema ? 'hidden' : ''} px-3 lg:absolute lg:left-4 lg:top-12 lg:w-panel lg:px-0`}
    >
      {duo ? (
        <DuoPanel api={api} onRestart={() => loop.reset()} />
      ) : (
        <FreePanel api={api} onRestart={() => loop.reset()} />
      )}
    </aside>
  );
}

/** Everything beside the canvas on a track: lap board, sensors, telemetry, panel and celebration. */
function TrackPanels({
  state,
  cinema,
  robotHref,
}: {
  state: ArenaState;
  cinema: boolean;
  robotHref: string;
}): JSX.Element {
  const { mobile, api, drive, loop, challenges } = state;
  return (
    <>
      <HudAside cinema={cinema} loop={loop} mobile={mobile} />
      <aside
        className={`${cinema ? 'hidden' : ''} px-3 lg:absolute lg:left-4 lg:top-12 lg:bottom-12 lg:w-panel lg:overflow-y-auto lg:px-0`}
      >
        <ArenaPanel
          spec={mobile}
          api={api}
          drive={drive}
          passed={challenges.passed}
          robotHref={robotHref}
        />
      </aside>
      <ChallengeCelebration challenges={challenges} />
    </>
  );
}

/**
 * The 3D line-follower arena: the same simulation as the 2D simulator, staged as a dark 3D
 * track with chase cameras, big readable instruments, a race against the reference robot,
 * self-checking challenges and video recording for social media. Its free mode swaps the line
 * for an open floor with cones and stars, driven by hand.
 */
export function Arena({ robotHref, robot }: ArenaProps): JSX.Element {
  const state = useArena(robot);
  const { api, free, refs, loop } = state;
  const bar = useTopBar(refs, loop, api);
  // Cinema is the camera for watching and recording: the panels step aside, as in Brazo.
  const cinema = api.settings.camera === 'cinema';
  return (
    <div
      ref={refs.root}
      data-theme="dark"
      className="relative flex flex-col gap-3 bg-bg pb-4 text-fg lg:block lg:h-[calc(100dvh-4rem)] lg:min-h-[40rem] lg:overflow-hidden lg:pb-0"
    >
      <ArenaStage refs={refs} loop={loop} api={api} bar={bar} free={free} />
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 lg:hidden">
        <Brand status={bar.status} free={bar.free} />
        <VideoTools {...bar} />
      </div>
      <SidePanels state={state} cinema={cinema} robotHref={robotHref} />
    </div>
  );
}
