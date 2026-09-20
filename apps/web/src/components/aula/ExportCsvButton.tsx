import { useT } from '@trayectoria/i18n';
import { Toast } from '@trayectoria/widgets';
import { useState, type JSX } from 'react';

import { fileName, toCsv, type CsvRecord } from '../../lib/aula/csv';
import {
  cellOf,
  type MatrixMember,
  type MatrixTopic,
  type ProgressMatrix,
} from '../../lib/aula/progressMatrix';
import { SECONDARY_BUTTON } from '../auth/fields';

export interface ExportCsvButtonProps {
  readonly groupName: string;
  readonly topics: readonly MatrixTopic[];
  readonly members: readonly MatrixMember[];
  readonly matrix: ProgressMatrix;
}

/** One record per (student, topic), in the order of the table: students, then topics. */
function records(
  topics: readonly MatrixTopic[],
  members: readonly MatrixMember[],
  matrix: ProgressMatrix,
): CsvRecord[] {
  return members.flatMap((member) =>
    topics.map((topic) => {
      const cell = cellOf(matrix, topic.id, member.userId);
      return {
        studentName: member.displayName,
        topicId: topic.id,
        status: cell.status,
        bestScore: cell.bestScore,
        attempts: cell.attempts,
        completedAt: cell.completedAt,
      };
    }),
  );
}

/**
 * Hands the file to the browser through a temporary `<a download>` and an object URL; there is
 * no upload and no server, the CSV is built in the page from what the table already shows.
 */
function download(csv: string, name: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * "Exportar CSV" of the classroom (F3-02b): the whole matrix, pending cells included, with the
 * toast of docs/DESIGN.md §5. The date of the file name is the teacher's own clock.
 */
export function ExportCsvButton({
  groupName,
  topics,
  members,
  matrix,
}: ExportCsvButtonProps): JSX.Element {
  const t = useT();
  const [toast, setToast] = useState('');

  const exportCsv = (): void => {
    download(toCsv(records(topics, members, matrix)), fileName(groupName, new Date()));
    setToast(t('aula.progress.exported'));
  };

  return (
    <>
      <button
        type="button"
        onClick={exportCsv}
        aria-label={t('aula.progress.export')}
        data-testid="export-csv"
        className={SECONDARY_BUTTON}
      >
        {t('aula.progress.export')}
      </button>
      {toast !== '' ? <Toast message={toast} onClose={() => setToast('')} /> : null}
    </>
  );
}
