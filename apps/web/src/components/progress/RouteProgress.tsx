import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import { useProgress } from '@trayectoria/progress';
import type { TopicProgress } from '@trayectoria/progress';

/** Estado que muestra el índice de la ruta para un tema (#120, decisión 4). */
export type TopicState = 'pending' | 'in_progress' | 'completed';

function stateOf(progress: TopicProgress | undefined): TopicState {
  if (progress === undefined) return 'pending';
  return progress.status === 'completed' ? 'completed' : 'in_progress';
}

/** Texto del estado; el estado nunca se codifica solo por color (DESIGN.md §9 punto 11). */
function labelOf(state: TopicState, t: Translate): string {
  if (state === 'completed') return t('progress.status.completed');
  if (state === 'in_progress') return t('progress.status.inProgress');
  return t('progress.status.pending');
}

// Celda de estado de DESIGN.md §5 Tabla: cuadrado de 26 px, radio `sm`, letra además de color,
// tinta `bg-raised` sobre el color y `title` con el texto. Pendiente lleva solo borde.
const CELL = 'inline-flex size-[26px] shrink-0 items-center justify-center rounded-sm font-mono text-xs';
const CELL_BY_STATE: Record<TopicState, string> = {
  completed: `${CELL} bg-success text-bg-raised`,
  in_progress: `${CELL} bg-primary text-bg-raised`,
  pending: `${CELL} border-border text-fg-muted border`,
};
const LETTER: Record<TopicState, string> = { completed: 'C', in_progress: 'E', pending: '' };

export interface TopicStatusProps {
  /** Id del tema (`ruta-1/m00-t01`). */
  readonly topicId: string;
}

/**
 * Estado de un tema en el índice de la ruta: el cuadrado de DESIGN.md §5 Tabla más el texto.
 * El servidor lo pinta pendiente; la isla hidrata desde `$progress`.
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
      <span className={CELL_BY_STATE[state]} title={label} aria-hidden="true">
        {LETTER[state]}
      </span>
    </span>
  );
}

export interface RouteProgressProps {
  /** Ids de los temas de la ruta (`ruta-1/m00-t01`), en el orden de `ruta.json`. */
  readonly topicIds: readonly string[];
}

/**
 * Barra de progreso de la ruta (#120, decisión 4): 4 px con la cifra mono `completados/total`
 * (DESIGN.md §5 Barra de progreso). El servidor pinta `0/N`; la isla hidrata desde `$progress`.
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
