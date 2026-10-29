import { useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { Celebration } from './Celebration';
import type { FreeProgress } from './freeRace';
import type { Overlay } from './recorder';
import { HUD_CARD } from './ArenaHud';
import type { FreeDriveApi } from './useFreeDrive';
import type { Steer } from './useManualDrive';

/** Stopwatch text: seconds with a tenth, `m:ss.t` past a minute. */
export function clock(time_s: number): string {
  const minutes = Math.floor(time_s / 60);
  const seconds = (time_s - minutes * 60).toFixed(1).padStart(minutes > 0 ? 4 : 1, '0');
  return minutes > 0 ? `${minutes}:${seconds}` : seconds;
}

/** The recording overlay of a free run: stars and time. */
export function freeOverlay(t: Translate, free: FreeProgress): Overlay {
  return {
    title: `${t('sims.arena.brand')} · ${t('sims.arena.free.card')}`,
    lines: [
      `${t('sims.arena.free.goals')}  ${free.collected}/${free.total}`,
      `${t('sims.arena.free.time')}  ${clock(free.time_s)} s`,
    ],
    footer: 'trayectoria.org',
  };
}

/** Stars collected and stopwatch, big enough to read from across a classroom. */
function FreeBoard({ progress }: { progress: FreeProgress }): JSX.Element {
  const t = useT();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-12 z-10 flex justify-center px-3">
      <section
        className={`${HUD_CARD} flex items-center gap-6 px-6 py-3`}
        aria-label={t('sims.arena.free.board')}
      >
        <div className="flex flex-col">
          <span className="text-xs text-fg-muted">{t('sims.arena.free.goals')}</span>
          <span className="font-mono text-3xl font-semibold leading-tight text-physical">
            {`${progress.collected}/${progress.total}`}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-fg-muted">{t('sims.arena.free.time')}</span>
          <span className="font-mono text-3xl font-semibold leading-tight text-fg">
            {`${clock(progress.time_s)} s`}
          </span>
        </div>
      </section>
    </div>
  );
}

const PAD_BUTTON =
  'flex min-h-12 min-w-8 touch-none select-none items-center justify-center gap-2 rounded-lg border border-border bg-bg-raised/90 px-3 py-3 sm:px-6 text-xl font-semibold text-fg shadow-md backdrop-blur active:border-primary active:bg-primary active:text-primary-fg';

/** A button that acts only while it is held down, for the thumbs of a phone. */
function HoldButton({
  glyph,
  label,
  onHold,
}: {
  glyph: string;
  label: string;
  onHold: (held: boolean) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className={PAD_BUTTON}
      aria-label={label}
      onPointerDown={() => onHold(true)}
      onPointerUp={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span aria-hidden="true">{glyph}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/** Turn on the left thumb, go on the right one; `keyboardOnly` leaves it to phones and tablets. */
export function FreePad({
  drive,
  keyboardOnly = false,
}: {
  drive: FreeDriveApi;
  keyboardOnly?: boolean;
}): JSX.Element {
  const t = useT();
  const hold = (set: (value: Steer) => void, value: Steer) => (held: boolean) =>
    set(held ? value : 0);
  return (
    <div
      className={`absolute inset-x-0 bottom-3 z-10 flex items-end justify-between gap-3 px-3 lg:bottom-4 ${keyboardOnly ? 'lg:hidden' : ''}`}
    >
      <div className="flex gap-3">
        <HoldButton glyph="◀" label={t('sims.arena.free.left')} onHold={hold(drive.setSteer, 1)} />
        <HoldButton
          glyph="▶"
          label={t('sims.arena.free.right')}
          onHold={hold(drive.setSteer, -1)}
        />
      </div>
      <div className="flex gap-3">
        <HoldButton glyph="▼" label={t('sims.arena.free.back')} onHold={hold(drive.setGo, -1)} />
        <HoldButton glyph="▲" label={t('sims.arena.free.forward')} onHold={hold(drive.setGo, 1)} />
      </div>
    </div>
  );
}

export interface FreeLayerProps {
  readonly progress: FreeProgress | null;
  readonly drive: FreeDriveApi;
  readonly onRestart: () => void;
}

/** What floats over the canvas in the free arena: the board, the pad and the final celebration. */
export function FreeLayer({ progress, drive, onRestart }: FreeLayerProps): JSX.Element {
  const t = useT();
  // The time the closed celebration was for: a new run ends at another time and celebrates again.
  const [closedAt, setClosedAt] = useState<number | null>(null);
  const celebrate = progress !== null && progress.done && progress.time_s !== closedAt;
  return (
    <>
      {progress === null ? null : <FreeBoard progress={progress} />}
      <FreePad drive={drive} />
      {celebrate ? (
        <Celebration
          heading={t('sims.arena.free.done')}
          title={t('sims.arena.free.doneTitle', { time: clock(progress.time_s) })}
          learned={t('sims.arena.free.learned')}
          nextLabel={t('sims.arena.free.again')}
          closeLabel={t('sims.arena.free.close')}
          onNext={onRestart}
          onClose={() => setClosedAt(progress.time_s)}
        />
      ) : null}
    </>
  );
}
