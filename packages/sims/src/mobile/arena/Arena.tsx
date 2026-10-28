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
import { Celebration } from './Celebration';
import { challengeText } from './ChallengesTab';
import { KICK_RAD } from './race';
import type { Overlay } from './recorder';
import { TelemetryChart } from './TelemetryChart';
import { useArenaLoop } from './useArenaLoop';
import type { ArenaLoop, ArenaRefs } from './useArenaLoop';
import { useArenaSettings } from './useArenaSettings';
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
  return settings.controller === 'manual' ? 'manual' : 'running';
}

function overlayOf(t: Translate, loop: ArenaLoop, settings: ArenaSettings): Overlay {
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

function Tag({
  tagRef,
  label,
  className,
}: {
  tagRef: ArenaRefs['youTag'];
  label: string;
  className: string;
}): JSX.Element {
  return (
    <div
      ref={tagRef}
      hidden
      className={`pointer-events-none absolute left-0 top-0 rounded-full px-2 py-1 font-mono text-xs font-semibold shadow-md ${className}`}
    >
      {label}
    </div>
  );
}

function ChallengeBanner({ settings }: { settings: ArenaSettings }): JSX.Element | null {
  const t = useT();
  if (settings.challenge === null) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-12 z-10 flex justify-center px-3 lg:top-12">
      <p className="max-w-form-card rounded-lg border border-physical bg-bg-raised/90 px-4 py-2 text-center text-sm text-fg shadow-md backdrop-blur">
        <span className="font-semibold text-physical">{`${challengeText(t, settings.challenge, 'title')} · `}</span>
        {challengeText(t, settings.challenge, 'goal')}
      </p>
    </div>
  );
}

function useArena(robot: RobotSpec | undefined) {
  const myRobot = useMyRobot();
  const spec = robot ?? myRobot;
  const mobile: MobileSpec | undefined = spec.mobile;
  if (mobile === undefined)
    throw new Error('La pista 3D requiere un robot con perfil «mobile-diff»');
  const api = useArenaSettings();
  const drive = useManualDrive(mobile, api.settings.controller === 'manual');
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
    command: drive.command,
  });
  useArenaKeys(loop, api);
  const challenges = useChallengeCheck(loop.snapshot, api);
  return { mobile, api, drive, refs, loop, challenges };
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

/** The canvas with the name tags and the bars floating over it. */
function ArenaStage({
  refs,
  loop,
  api,
  bar,
}: {
  refs: ArenaRefs;
  loop: ArenaLoop;
  api: ArenaSettingsApi;
  bar: TopBarProps;
}): JSX.Element {
  const t = useT();
  const { settings } = api;
  return (
    <div className="relative h-[64dvh] lg:absolute lg:inset-0 lg:h-auto">
      <canvas
        ref={refs.canvas}
        className="block h-full w-full touch-none"
        aria-label={t('sims.arenaPage.lead')}
      />
      <Tag
        tagRef={refs.youTag}
        label={t('sims.arena.you')}
        className="bg-physical text-physical-fg"
      />
      <Tag
        tagRef={refs.ghostTag}
        label={t('sims.arena.reference')}
        className="bg-primary text-primary-fg"
      />
      <TopBar {...bar} />
      <ChallengeBanner settings={settings} />
      <Playback loop={loop} api={api} />
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

/**
 * The 3D line-follower arena: the same simulation as the 2D simulator, staged as a dark 3D
 * track with chase cameras, big readable instruments, a race against the reference robot,
 * self-checking challenges and video recording for social media.
 */
export function Arena({ robotHref, robot }: ArenaProps): JSX.Element {
  const { mobile, api, drive, refs, loop, challenges } = useArena(robot);
  const bar = useTopBar(refs, loop, api);
  // Cinema is the camera for watching and recording: the panels step aside, as in Brazo.
  const cinema = api.settings.camera === 'cinema';
  return (
    <div
      ref={refs.root}
      data-theme="dark"
      className="relative flex flex-col gap-3 bg-bg pb-4 text-fg lg:block lg:h-[calc(100dvh-4rem)] lg:min-h-[40rem] lg:overflow-hidden lg:pb-0"
    >
      <ArenaStage refs={refs} loop={loop} api={api} bar={bar} />
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 lg:hidden">
        <Brand status={bar.status} />
        <VideoTools {...bar} />
      </div>
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
      {challenges.celebrating === null ? null : (
        <Celebration
          id={challenges.celebrating}
          onNext={challenges.next}
          onClose={challenges.dismiss}
        />
      )}
    </div>
  );
}
