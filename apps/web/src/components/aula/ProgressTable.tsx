import { useT } from '@trayectoria/i18n';
import { useEffect, useState, type JSX } from 'react';

import { listProgress, type Member } from '../../lib/aula/groups';
import {
  progressMatrix,
  type MatrixMember,
  type MatrixTopic,
  type ProgressRow,
} from '../../lib/aula/progressMatrix';
import { ExportCsvButton } from './ExportCsvButton';
import { ProgressGrid } from './ProgressGrid';

// Classroom progress panel (F3-02b). `listProgress` reads the rows under the "progress: own or
// taught reads" policy of migration 0002, with the teacher's own session and the anon key; the
// grid and the CSV both work off the matrix built here.

export interface ProgressTableProps {
  readonly groupName: string;
  readonly members: readonly Member[];
  /** Topics of the route, in the order of `ruta.json`, from the Astro page. */
  readonly topics: readonly MatrixTopic[];
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

/** Topic × student table with the CSV export (F3-02b). */
export function ProgressTable({ groupName, members, topics }: ProgressTableProps): JSX.Element {
  const t = useT();
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
