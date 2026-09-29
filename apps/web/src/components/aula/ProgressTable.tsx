import { useT } from '@trayectoria/i18n';
import { useEffect, useId, useState, type JSX } from 'react';

import { listProgress, type Member } from '../../lib/aula/groups';
import {
  progressMatrix,
  type MatrixMember,
  type MatrixRoute,
  type ProgressRow,
} from '../../lib/aula/progressMatrix';
import { ExportCsvButton } from './ExportCsvButton';
import { ProgressGrid } from './ProgressGrid';

// Classroom progress panel (F3-02b). `listProgress` reads the rows under the "progress: own or
// taught reads" policy of migration 0002, with the teacher's own session and the anon key; the
// grid and the CSV both work off the matrix built here, for the route chosen in the selector
// (docs/ARCHITECTURE.md §3.2, «Aula con dos rutas»): the query does not change, each route uses
// its own rows.

export interface ProgressTableProps {
  readonly groupName: string;
  readonly members: readonly Member[];
  /** The routes and their topics, in route order, from the Astro page. */
  readonly routes: readonly MatrixRoute[];
}

// Chip version of the segmented control of docs/DESIGN.md §5 (Tabs / segmentado): a `border`
// container with `sm` radius, children split by an inner border, active in `primary`.
const CHIP = 'h-10 px-3 text-sm font-semibold transition-colors duration-[120ms]';
const CHIP_ACTIVE = `${CHIP} bg-primary text-primary-fg`;
const CHIP_INACTIVE = `${CHIP} text-fg-muted hover:text-fg`;

interface RouteSelectorProps {
  readonly routes: readonly MatrixRoute[];
  readonly selectedId: string;
  readonly onSelect: (routeId: string) => void;
}

/** «Ruta»: one chip per route, with its short title and `aria-pressed` (§3.2). */
function RouteSelector({ routes, selectedId, onSelect }: RouteSelectorProps): JSX.Element {
  const t = useT();
  const labelId = useId();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <span className="text-fg-muted text-sm" id={labelId}>
        {t('aula.progress.route')}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="border-border divide-border flex w-fit divide-x overflow-hidden rounded-sm border"
        data-testid="progress-route-selector"
      >
        {routes.map((route) => (
          <button
            key={route.id}
            type="button"
            aria-pressed={route.id === selectedId}
            className={route.id === selectedId ? CHIP_ACTIVE : CHIP_INACTIVE}
            data-route={route.id}
            onClick={() => onSelect(route.id)}
          >
            {route.shortTitle}
          </button>
        ))}
      </div>
    </div>
  );
}

type Phase = 'loading' | 'ready' | 'error';

/** While the rows are on their way, or when the query failed. */
function Phasing({ phase }: { readonly phase: Phase }): JSX.Element {
  const t = useT();
  const failed = phase === 'error';
  return (
    <p
      aria-live="polite"
      role={failed ? 'alert' : undefined}
      className={failed ? 'text-error m-0 mt-3' : 'text-fg-muted m-0 mt-3'}
    >
      {failed ? t('aula.progress.failed') : t('aula.loading')}
    </p>
  );
}

/** Progress of every member, re-read whenever the member list changes. */
function useProgressRows(memberIds: readonly string[]): { rows: ProgressRow[]; phase: Phase } {
  const [rows, setRows] = useState<ProgressRow[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const key = memberIds.join(',');
  useEffect(() => {
    let cancelled = false;
    setPhase('loading');
    void listProgress(key === '' ? [] : key.split(',')).then(
      (data) => {
        if (cancelled) return;
        setRows(data);
        setPhase('ready');
      },
      () => !cancelled && setPhase('error'),
    );
    return () => {
      cancelled = true;
    };
  }, [key]);
  return { rows, phase };
}

/** Topic × student table of the chosen route, with the CSV export (F3-02b, #574). */
export function ProgressTable({ groupName, members, routes }: ProgressTableProps): JSX.Element {
  const t = useT();
  // Starts on the first route, Fundamentos (§3.2).
  const [selectedId, setSelectedId] = useState(routes[0]?.id ?? '');
  const topics = routes.find((route) => route.id === selectedId)?.topics ?? [];
  const { rows, phase } = useProgressRows(members.map((member) => member.userId));
  const students: MatrixMember[] = members.map((member) => ({
    userId: member.userId,
    displayName: member.displayName === '' ? t('aula.members.unknown') : member.displayName,
  }));
  const matrix = progressMatrix(topics, students, rows);
  const ready = phase === 'ready';

  return (
    <section
      className="border-border bg-bg-raised rounded-lg border p-6"
      data-testid="progress-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t('aula.progress.title')}</h2>
        {students.length > 0 && ready ? (
          <ExportCsvButton
            groupName={groupName}
            topics={topics}
            members={students}
            matrix={matrix}
          />
        ) : null}
      </div>
      {students.length > 0 ? (
        <RouteSelector routes={routes} selectedId={selectedId} onSelect={setSelectedId} />
      ) : null}
      {students.length === 0 ? (
        <p className="text-fg-muted mt-3 mb-0" data-testid="progress-empty">
          {t('aula.progress.empty')}
        </p>
      ) : ready ? (
        <ProgressGrid topics={topics} members={students} matrix={matrix} groupName={groupName} />
      ) : (
        <Phasing phase={phase} />
      )}
    </section>
  );
}
