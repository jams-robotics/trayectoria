import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import { CAMERA_MODES } from './scene/cameraRig';
import type { CameraMode } from './scene/cameraRig';
import { PLAYBACK_SPEEDS } from './useArenaSettings';

const GLASS = 'rounded-lg border border-border bg-bg-raised/85 shadow-md backdrop-blur';
const BUTTON = 'min-h-10 rounded-md px-3 text-sm font-semibold transition-colors';
const QUIET = `${BUTTON} text-fg hover:bg-bg`;

export type ArenaStatus = 'running' | 'paused' | 'derailed' | 'manual' | 'duo';

const STATUS_DOT: Record<ArenaStatus, string> = {
  running: 'bg-success',
  paused: 'bg-fg-muted',
  derailed: 'bg-error',
  manual: 'bg-physical',
  duo: 'bg-physical',
};

export interface TopBarProps {
  readonly status: ArenaStatus;
  readonly camera: CameraMode;
  readonly onCamera: (mode: CameraMode) => void;
  readonly recording: boolean;
  readonly canRecord: boolean;
  readonly vertical: boolean;
  readonly onVertical: (vertical: boolean) => void;
  readonly onRecord: () => void;
  readonly onFullscreen: () => void;
  /** The free arena is on: the brand names it instead of the line follower. */
  readonly free: boolean;
}

export function Brand({ status, free }: { status: ArenaStatus; free: boolean }): JSX.Element {
  const t = useT();
  return (
    <div className={`${GLASS} flex items-center gap-3 px-3 py-2`}>
      <div className="flex flex-col">
        <span className="text-base font-semibold leading-tight text-fg">
          {t('sims.arena.brand')}
        </span>
        <span className="font-mono text-xs text-fg-muted">
          {t(free ? 'sims.arena.subtitleFree' : 'sims.arena.subtitle')}
        </span>
      </div>
      <span
        className="flex items-center gap-2 rounded-full border border-border px-2 py-1 text-xs text-fg"
        role="status"
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
        {t(`sims.arena.status.${status}`)}
      </span>
    </div>
  );
}

function Cameras({
  camera,
  onCamera,
}: {
  camera: CameraMode;
  onCamera: (mode: CameraMode) => void;
}): JSX.Element {
  const t = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t('sims.arena.camera.label')}
      className={`${GLASS} flex gap-1 overflow-x-auto p-1`}
    >
      {CAMERA_MODES.map((mode, i) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={camera === mode}
          aria-keyshortcuts={String(i + 1)}
          onClick={() => onCamera(mode)}
          className={`${BUTTON} whitespace-nowrap ${camera === mode ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:text-fg'}`}
        >
          {t(`sims.arena.camera.${mode}`)}
        </button>
      ))}
    </div>
  );
}

/** Brand and status on the left, the camera modes in the middle, video and fullscreen on the right. */
export function TopBar(props: TopBarProps): JSX.Element {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 p-3 lg:p-4 [&>*]:pointer-events-auto">
      <div className="hidden lg:block">
        <Brand status={props.status} free={props.free} />
      </div>
      <Cameras camera={props.camera} onCamera={props.onCamera} />
      <div className="hidden lg:block">
        <VideoTools {...props} />
      </div>
    </div>
  );
}

/** «Grabar» with its format, and fullscreen. On phones it sits under the canvas. */
export function VideoTools(props: TopBarProps): JSX.Element {
  const t = useT();
  return (
    <div className={`${GLASS} flex items-center gap-1 p-1`}>
      {props.canRecord ? (
        <>
          <label className="flex items-center gap-2 px-2 text-xs text-fg-muted">
            <input
              type="checkbox"
              className="accent-primary"
              checked={props.vertical}
              disabled={props.recording}
              onChange={(event) => props.onVertical(event.target.checked)}
            />
            {t('sims.arena.recordVertical')}
          </label>
          <button
            type="button"
            onClick={props.onRecord}
            title={t('sims.arena.recordHint')}
            className={`${BUTTON} ${props.recording ? 'bg-error text-bg-raised' : 'text-fg hover:bg-bg'}`}
          >
            {props.recording ? `■ ${t('sims.arena.recordStop')}` : `● ${t('sims.arena.record')}`}
          </button>
        </>
      ) : null}
      <button
        type="button"
        onClick={props.onFullscreen}
        className={QUIET}
        aria-label={t('sims.arena.fullscreen')}
        title={t('sims.arena.fullscreen')}
      >
        ⛶
      </button>
    </div>
  );
}

export interface PlaybackBarProps {
  readonly running: boolean;
  readonly speed: number;
  readonly onToggle: () => void;
  readonly onReset: () => void;
  readonly onKick: () => void;
  readonly onSpeed: (speed: number) => void;
}

function SpeedPicker({
  speed: current,
  onSpeed,
}: Pick<PlaybackBarProps, 'speed' | 'onSpeed'>): JSX.Element {
  const t = useT();
  return (
    <div
      role="radiogroup"
      aria-label={t('sims.arena.speed')}
      className="hidden gap-1 border-l border-border pl-1 sm:flex"
    >
      {PLAYBACK_SPEEDS.map((speed) => (
        <button
          key={speed}
          type="button"
          role="radio"
          aria-checked={current === speed}
          onClick={() => onSpeed(speed)}
          className={`${BUTTON} px-2 font-mono ${current === speed ? 'bg-bg text-fg' : 'text-fg-muted hover:text-fg'}`}
        >
          {`${speed}×`}
        </button>
      ))}
    </div>
  );
}

/** Start or pause, restart, the kick that tests the controller, and the playback speed. */
export function PlaybackBar(props: PlaybackBarProps): JSX.Element {
  const t = useT();
  return (
    <div className={`${GLASS} flex items-center justify-center gap-1 p-1`}>
      <button
        type="button"
        onClick={props.onToggle}
        aria-keyshortcuts="Space"
        className={`${BUTTON} min-w-12 bg-primary text-primary-fg hover:bg-primary-hover`}
      >
        {props.running ? `❚❚ ${t('sims.arena.pause')}` : `▶ ${t('sims.arena.play')}`}
      </button>
      <button type="button" onClick={props.onReset} aria-keyshortcuts="R" className={QUIET}>
        {`↺ ${t('sims.arena.reset')}`}
      </button>
      <button
        type="button"
        onClick={props.onKick}
        aria-keyshortcuts="K"
        title={t('sims.arena.kickHint')}
        className={`${BUTTON} text-physical hover:bg-bg`}
      >
        {`⤳ ${t('sims.arena.kick')}`}
      </button>
      <SpeedPicker speed={props.speed} onSpeed={props.onSpeed} />
    </div>
  );
}
