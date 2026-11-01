import { useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { HUD_CARD } from './ArenaHud';
import { Celebration } from './Celebration';
import type { DuoProgress, Player } from './duoRace';
import { FreePad, clock } from './FreeHud';
import type { Overlay } from './recorder';
import type { FreeDriveApi } from './useFreeDrive';

/** The text of the score of `player`: laps or stars taken over what wins or is there to take. */
function scoreText(progress: DuoProgress, player: Player): string {
  return `${progress.scores[player - 1] ?? 0}/${progress.goal}`;
}

/** The recording overlay of a two-player run: both scores and the time. */
export function duoOverlay(t: Translate, progress: DuoProgress): Overlay {
  const what = t(progress.kind === 'laps' ? 'sims.arena.hud.laps' : 'sims.arena.free.goals');
  return {
    title: `${t('sims.arena.brand')} · ${t('sims.arena.duo.title')}`,
    lines: [
      `${t('sims.arena.duo.player', { n: 1 })}  ${scoreText(progress, 1)} ${what}`,
      `${t('sims.arena.duo.player', { n: 2 })}  ${scoreText(progress, 2)} ${what}`,
      `${t('sims.arena.free.time')}  ${clock(progress.time_s)} s`,
    ],
    footer: 'trayectoria.org',
  };
}

function ScoreCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}): JSX.Element {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-fg-muted">{label}</span>
      <span
        className={`whitespace-nowrap font-mono text-2xl font-semibold leading-tight sm:text-3xl ${tone}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Both players' score and the stopwatch, big enough to read from across a classroom. */
function DuoBoard({ progress }: { progress: DuoProgress }): JSX.Element {
  const t = useT();
  const what = t(progress.kind === 'laps' ? 'sims.arena.hud.laps' : 'sims.arena.free.goals');
  return (
    <div className="pointer-events-none absolute inset-x-0 top-12 z-10 flex flex-col items-center gap-2 px-3">
      <section
        className={`${HUD_CARD} flex items-center gap-3 px-3 py-3 sm:gap-6 sm:px-6`}
        aria-label={t('sims.arena.free.board')}
      >
        <ScoreCell
          label={`${t('sims.arena.duo.player', { n: 1 })} · ${what}`}
          value={scoreText(progress, 1)}
          tone="text-physical"
        />
        <ScoreCell
          label={t('sims.arena.free.time')}
          value={`${clock(progress.time_s)} s`}
          tone="text-fg"
        />
        <ScoreCell
          label={`${t('sims.arena.duo.player', { n: 2 })} · ${what}`}
          value={scoreText(progress, 2)}
          tone="text-primary"
        />
      </section>
      <p className={`${HUD_CARD} px-3 py-2 text-center text-xs text-fg-muted lg:hidden`}>
        {t('sims.arena.duo.touchNote')}
      </p>
    </div>
  );
}

/** «Gana el jugador 2», over confetti; «Empate» when the stars ended level. */
function DuoWinner({
  progress,
  onRestart,
  onClose,
}: {
  progress: DuoProgress;
  onRestart: () => void;
  onClose: () => void;
}): JSX.Element {
  const t = useT();
  return (
    <Celebration
      heading={t('sims.arena.duo.done')}
      title={
        progress.winner === null
          ? t('sims.arena.duo.tie')
          : t('sims.arena.duo.winner', { n: progress.winner })
      }
      learned={t('sims.arena.duo.learned')}
      nextLabel={t('sims.arena.free.again')}
      closeLabel={t('sims.arena.free.close')}
      onNext={onRestart}
      onClose={onClose}
    />
  );
}

export interface DuoLayerProps {
  readonly progress: DuoProgress | null;
  /** The buttons of player 1, for a phone: player 2 has no room, so it plays on a keyboard. */
  readonly drive: FreeDriveApi;
  readonly onRestart: () => void;
}

/** What floats over the canvas in a two-player race: the board, the pad of player 1 and the winner. */
export function DuoLayer({ progress, drive, onRestart }: DuoLayerProps): JSX.Element {
  // The time the closed dialog was for: a new run ends at another time and celebrates again.
  const [closedAt, setClosedAt] = useState<number | null>(null);
  const celebrate = progress !== null && progress.done && progress.time_s !== closedAt;
  return (
    <>
      {progress === null ? null : <DuoBoard progress={progress} />}
      <FreePad drive={drive} keyboardOnly />
      {celebrate ? (
        <DuoWinner
          progress={progress}
          onRestart={onRestart}
          onClose={() => setClosedAt(progress.time_s)}
        />
      ) : null}
    </>
  );
}
