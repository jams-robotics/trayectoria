import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import { useProgress } from '@trayectoria/progress';
import type { TopicProgress } from '@trayectoria/progress';

import { isRouteCompleted } from '../../lib/progress/routeCompleted';

/** State the route index shows for a topic (#120, decision 4). */
export type TopicState = 'pending' | 'in_progress' | 'completed';

function stateOf(progress: TopicProgress | undefined): TopicState {
  if (progress === undefined) return 'pending';
  return progress.status === 'completed' ? 'completed' : 'in_progress';
}

/** Text of the state; the state is never encoded by colour alone (DESIGN.md §9 point 11). */
function labelOf(state: TopicState, t: Translate): string {
  if (state === 'completed') return t('progress.status.completed');
  if (state === 'in_progress') return t('progress.status.inProgress');
  return t('progress.status.pending');
}

// Status indicator (#532): the state changes only from the system, so it must not look like a
// control. A colour dot for "en curso", a tenue check for "hecho", nothing but the text for
// "pendiente" (docs/DESIGN.md §2.1 tokens; DESIGN.md §9 point 11: state is never colour alone,
// hence the `title` and the text besides it).
const DOT = 'inline-block size-[10px] shrink-0 rounded-full bg-primary';
const CHECK = 'text-success/60 shrink-0 text-base leading-none';

export interface TopicStatusProps {
  /** Topic id (`ruta-1/m00-t01`). */
  readonly topicId: string;
}

/**
 * State of a topic in the route index: the text plus a non-interactive indicator (#532).
 * The server renders it pending; the island hydrates from `$progress`.
 */
export function TopicStatus({ topicId }: TopicStatusProps): JSX.Element {
  const t = useT();
  const state = stateOf(useProgress()[topicId]);
  const label = labelOf(state, t);
  return (
    <span
      className="ml-auto flex items-center gap-2"
      data-testid="topic-status"
      data-topic={topicId}
      data-state={state}
    >
      <span className="text-fg-muted text-sm">{label}</span>
      {state === 'in_progress' && <span className={DOT} title={label} aria-hidden="true" />}
      {state === 'completed' && (
        <span className={CHECK} title={label} aria-hidden="true">
          ✓
        </span>
      )}
    </span>
  );
}

export interface RouteProgressProps {
  /** Ids of the route's topics (`ruta-1/m00-t01`), in the order of `ruta.json`. */
  readonly topicIds: readonly string[];
}

/**
 * Route progress bar (#120, decision 4): 4 px with the mono figure `completed/total`
 * (DESIGN.md §5 Barra de progreso). The server renders `0/N`; the island hydrates from `$progress`.
 */
export function RouteProgress({ topicIds }: RouteProgressProps): JSX.Element {
  const t = useT();
  const progress = useProgress();
  const done = topicIds.filter((topicId) => progress[topicId]?.status === 'completed').length;
  const total = topicIds.length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="mt-5 flex max-w-[320px] items-center gap-3" data-testid="route-progress">
      <div
        className="bg-border rounded-sm h-1 flex-1 overflow-hidden"
        role="progressbar"
        aria-label={t('progress.route.label')}
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div className="bg-primary h-full" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-fg-muted font-mono text-xs" data-testid="route-progress-count">
        {t('progress.route.count', { done, total })}
      </span>
    </div>
  );
}

/**
 * «Ruta completada» notice under the route header (ARCHITECTURE §3.2): shown only once every
 * topic of the route is completed, from the same `$progress` as the per-topic states. Success
 * colour, no animation: feedback is never celebratory (DESIGN-BRIEF §5). The server renders
 * nothing; the island hydrates from `$progress`.
 */
export function RouteCompleted({ topicIds }: RouteProgressProps): JSX.Element | null {
  const t = useT();
  const progress = useProgress();
  if (!isRouteCompleted(topicIds, progress)) return null;
  return (
    <p
      className="text-success mt-3 text-sm font-semibold"
      role="status"
      data-testid="route-completed"
    >
      {t('route.completed')}
    </p>
  );
}
