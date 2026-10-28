import { useMemo } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import { trackLength_m } from '@trayectoria/sim-core';
import type { Track } from '@trayectoria/sim-core';

import { ARENA_TRACKS, ARENA_TRACK_IDS } from './arenaTracks';
import { FREE_LAYOUT } from './freeArena';
import type { ArenaTrackId } from './arenaTracks';
import { boundsOf, sampleTrack } from './scene/trackMesh';
import type { ArenaSettingsApi } from './useArenaSettings';

/** Side of the thumbnail's viewBox; the path is scaled into it keeping its proportions. */
const THUMB = 100;

/** The centerline as an SVG path, fitted in a `THUMB` square with some margin. */
function thumbPath(track: Track): string {
  const points = sampleTrack(track, 0.02);
  const bounds = boundsOf(points);
  const scale = (THUMB * 0.8) / Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const offsetX = (THUMB - (bounds.maxX - bounds.minX) * scale) / 2;
  const offsetY = (THUMB - (bounds.maxY - bounds.minY) * scale) / 2;
  return points
    .map(([x, y], i) => {
      const px = offsetX + (x - bounds.minX) * scale;
      const py = THUMB - (offsetY + (y - bounds.minY) * scale);
      return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(' ');
}

function Thumb({ path }: { path: string }): JSX.Element {
  return (
    <svg
      viewBox={`0 0 ${THUMB} ${THUMB}`}
      className="aspect-square w-full rounded-sm bg-sim-track"
      aria-hidden="true"
    >
      <path
        d={path}
        className="fill-none stroke-bg"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrackCard({
  id,
  active,
  onPick,
}: {
  id: ArenaTrackId;
  active: boolean;
  onPick: () => void;
}): JSX.Element {
  const t = useT();
  const track = ARENA_TRACKS[id];
  const path = useMemo(() => thumbPath(track), [track]);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPick}
      className={`flex flex-col gap-2 rounded-md border p-2 text-left transition-colors ${
        active ? 'border-primary bg-primary/10' : 'border-border bg-bg hover:border-fg-muted'
      }`}
    >
      <Thumb path={path} />
      <span className="text-sm font-semibold text-fg">{t(`sims.arena.track.${id}`)}</span>
      <span className="font-mono text-xs text-fg-muted">
        {t('sims.arena.track.length', { length: trackLength_m(track).toFixed(1) })}
      </span>
    </button>
  );
}

/** The free arena seen from above: its cones as dots and its stars as bigger, lighter ones. */
function FreeThumb(): JSX.Element {
  const scale = THUMB / (FREE_LAYOUT.halfWidth_m * 2 + 0.2);
  const place = (x_m: number, y_m: number) => ({
    cx: THUMB / 2 + x_m * scale,
    cy: THUMB / 2 - y_m * scale,
  });
  return (
    <svg
      viewBox={`0 0 ${THUMB} ${THUMB}`}
      className="aspect-square w-full rounded-sm bg-sim-track"
      aria-hidden="true"
    >
      {FREE_LAYOUT.cones.map((cone) => (
        <circle
          key={`${cone.x_m},${cone.y_m}`}
          r={3}
          className="fill-error"
          {...place(cone.x_m, cone.y_m)}
        />
      ))}
      {FREE_LAYOUT.goals.map((goal) => (
        <circle
          key={`${goal.x_m},${goal.y_m}`}
          r={4}
          className="fill-warning"
          {...place(goal.x_m, goal.y_m)}
        />
      ))}
    </svg>
  );
}

function FreeCard({ active, onPick }: { active: boolean; onPick: () => void }): JSX.Element {
  const t = useT();
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPick}
      className={`col-span-2 flex flex-col gap-2 rounded-md border p-2 text-left transition-colors ${
        active ? 'border-primary bg-primary/10' : 'border-border bg-bg hover:border-fg-muted'
      }`}
    >
      <FreeThumb />
      <span className="text-sm font-semibold text-fg">{t('sims.arena.free.card')}</span>
      <span className="text-xs text-fg-muted">{t('sims.arena.free.cardHint')}</span>
    </button>
  );
}

export interface TrackTabProps {
  readonly api: ArenaSettingsApi;
  /** Link to «Mi robot», whose measures build the 3D robot. */
  readonly robotHref: string;
}

/** The four tracks and the free arena as thumbnails, and where the robot's measures come from. */
export function TrackTab({ api, robotHref }: TrackTabProps): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {ARENA_TRACK_IDS.map((id) => (
          <TrackCard
            key={id}
            id={id}
            active={!api.settings.free && api.settings.track === id}
            onPick={() => api.pickTrack(id)}
          />
        ))}
        <FreeCard active={api.settings.free} onPick={api.startFree} />
      </div>
      <p className="text-sm text-fg-muted">{t('sims.arena.robotFrom')}</p>
      <a
        href={robotHref}
        className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
      >
        {t('sims.arena.editRobot')}
      </a>
    </div>
  );
}
