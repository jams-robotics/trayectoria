import { useT, type Translate } from '@trayectoria/i18n';
import type { JSX } from 'react';

import {
  cellOf,
  type Cell,
  type CellStatus,
  type MatrixMember,
  type MatrixTopic,
  type MemberSummary,
  type ProgressMatrix,
} from '../../lib/aula/progressMatrix';

// Markup of the topic × student table of the classroom (F3-02b); `ProgressTable.tsx` owns the
// query and hands the matrix over already built.
//
// Status cell of docs/DESIGN.md §5 (Tabla): 26 px square, radius `sm`, a letter besides the
// colour and `title` with the text. Pending is only a border; same spec as RouteProgress.tsx,
// whose cell is private to that component.
const CELL =
  'inline-flex size-[26px] shrink-0 items-center justify-center rounded-sm font-mono text-xs';
const CELL_BY_STATUS: Record<CellStatus, string> = {
  completed: `${CELL} bg-success text-bg-raised`,
  in_progress: `${CELL} bg-primary text-bg-raised`,
  pending: `${CELL} border-border text-fg-muted border`,
};
const LETTER: Record<CellStatus, string> = { completed: 'C', in_progress: 'E', pending: '' };

/** Width of the sticky first column, in pixels (docs/DESIGN.md §9 point 9). */
const FIRST_COLUMN = 'sticky left-0 w-[196px] min-w-[196px] max-w-[196px] bg-bg-raised';
const TOPIC_HEAD = 'border-border truncate border-b px-3 text-left text-sm font-normal';
const COL_HEAD = 'border-border border-b px-2 py-2 text-center';
const MODULE_HEAD =
  'bg-bg border-border sticky left-0 border-b px-3 py-2 text-left text-sm font-semibold';

function statusLabel(status: CellStatus, t: Translate): string {
  if (status === 'completed') return t('progress.status.completed');
  if (status === 'in_progress') return t('progress.status.inProgress');
  return t('progress.status.pending');
}

/** The `title` of a cell: student, topic and state, plus the score when there is one. */
function cellTitle(t: Translate, name: string, topicTitle: string, cell: Cell): string {
  const base = t('aula.progress.cellTitle', {
    name,
    topic: topicTitle,
    status: statusLabel(cell.status, t),
  });
  return cell.bestScore === null
    ? base
    : `${base} ${t('aula.progress.cellScore', { score: cell.bestScore.toFixed(2) })}`;
}

interface StatusCellProps {
  readonly cell: Cell;
  readonly title: string;
}

function StatusCell({ cell, title }: StatusCellProps): JSX.Element {
  return (
    <td
      className="border-border border-b px-2 text-center"
      data-testid="progress-cell"
      data-state={cell.status}
    >
      <span className={CELL_BY_STATUS[cell.status]} title={title}>
        <span className="sr-only">{title}</span>
        <span aria-hidden="true">{LETTER[cell.status]}</span>
      </span>
    </td>
  );
}

interface TopicRowProps {
  readonly topic: MatrixTopic;
  readonly members: readonly MatrixMember[];
  readonly matrix: ProgressMatrix;
}

function TopicRow({ topic, members, matrix }: TopicRowProps): JSX.Element {
  const t = useT();
  return (
    <tr className="h-[44px]" data-testid="progress-row" data-topic={topic.id}>
      <th scope="row" className={`${TOPIC_HEAD} ${FIRST_COLUMN}`} title={topic.title}>
        {topic.title}
      </th>
      {members.map((member) => {
        const cell = cellOf(matrix, topic.id, member.userId);
        return (
          <StatusCell
            key={member.userId}
            cell={cell}
            title={cellTitle(t, member.displayName, topic.title, cell)}
          />
        );
      })}
    </tr>
  );
}

interface SummaryCellProps {
  readonly name: string;
  readonly item: MemberSummary;
}

/** `completados/total` over a 4 px bar of 72 px (docs/DESIGN.md §5, §9 point 9). */
function SummaryCell({ name, item }: SummaryCellProps): JSX.Element {
  const t = useT();
  const percent = item.total === 0 ? 0 : Math.round((item.completed / item.total) * 100);
  return (
    <td className="px-2 py-2 text-center" data-testid="progress-summary">
      <div
        className="bg-border rounded-sm mx-auto h-1 w-[72px] overflow-hidden"
        role="progressbar"
        aria-label={t('aula.progress.barLabel', { name })}
        aria-valuenow={item.completed}
        aria-valuemin={0}
        aria-valuemax={item.total}
      >
        <div className="bg-primary h-full" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-fg-muted mt-1 block font-mono text-xs">
        {t('aula.progress.count', { done: item.completed, total: item.total })}
      </span>
    </td>
  );
}

interface SummaryRowProps {
  readonly members: readonly MatrixMember[];
  readonly matrix: ProgressMatrix;
}

/** Last row: `completados/total` per student over a 4 px bar (docs/DESIGN.md §5). */
function SummaryRow({ members, matrix }: SummaryRowProps): JSX.Element {
  const t = useT();
  return (
    <tr className="h-[44px]" data-testid="progress-summary-row">
      <th scope="row" className={`${FIRST_COLUMN} px-3 text-left text-sm font-semibold`}>
        {t('aula.progress.summary')}
      </th>
      {members.map((member, index) => (
        <SummaryCell
          key={member.userId}
          name={member.displayName}
          item={matrix.summary[index] ?? { userId: member.userId, completed: 0, total: 0 }}
        />
      ))}
    </tr>
  );
}

export interface ProgressGridProps {
  readonly topics: readonly MatrixTopic[];
  readonly members: readonly MatrixMember[];
  readonly matrix: ProgressMatrix;
  readonly groupName: string;
}

interface ModuleRowProps {
  readonly title: string;
  readonly span: number;
}

/** Module header row: `<th>` spanning the table, on `bg` (docs/DESIGN.md §9 point 9). */
function ModuleRow({ title, span }: ModuleRowProps): JSX.Element {
  return (
    <tr data-testid="progress-module-row">
      <th scope="colgroup" colSpan={span} className={MODULE_HEAD}>
        {title}
      </th>
    </tr>
  );
}

/** The topics of each module in a row block, in the order of `ruta.json`. */
function Body({ topics, members, matrix }: Omit<ProgressGridProps, 'groupName'>): JSX.Element {
  const body: JSX.Element[] = [];
  let lastModuleId = '';
  for (const topic of topics) {
    if (topic.moduleId !== lastModuleId) {
      lastModuleId = topic.moduleId;
      const span = members.length + 1;
      body.push(
        <ModuleRow key={`module-${topic.moduleId}`} title={topic.moduleTitle} span={span} />,
      );
    }
    body.push(<TopicRow key={topic.id} topic={topic} members={members} matrix={matrix} />);
  }
  return <tbody>{body}</tbody>;
}

/** Header: the "Tema" column and one column per student, in the order they joined. */
function Head({ members }: { readonly members: readonly MatrixMember[] }): JSX.Element {
  const t = useT();
  return (
    <thead>
      <tr>
        <th scope="col" className={`${FIRST_COLUMN} ${TOPIC_HEAD} z-20 py-2 font-semibold`}>
          {t('aula.progress.topic')}
        </th>
        {members.map((member) => (
          <th
            key={member.userId}
            scope="col"
            className={`${COL_HEAD} bg-bg-raised text-fg-muted font-mono text-xs font-normal`}
            data-testid="progress-column"
            data-user={member.userId}
          >
            {member.displayName}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function ProgressGrid({
  topics,
  members,
  matrix,
  groupName,
}: ProgressGridProps): JSX.Element {
  const t = useT();
  return (
    <>
      <div
        tabIndex={0}
        data-testid="progress-scroller"
        className="border-border rounded-lg focus-visible:outline-focus mt-3 overflow-auto border"
      >
        <table className="w-full border-collapse text-sm" data-testid="progress-table">
          <caption className="sr-only">{t('aula.progress.caption', { group: groupName })}</caption>
          <Head members={members} />
          <Body topics={topics} members={members} matrix={matrix} />
          <tfoot>
            <SummaryRow members={members} matrix={matrix} />
          </tfoot>
        </table>
      </div>
      <p className="text-fg-muted mt-2 mb-0 text-sm">{t('aula.progress.scrollHint')}</p>
    </>
  );
}
