import { useT } from '@trayectoria/i18n';
import { useState, type JSX } from 'react';

import { MOBILE_KIND, type RobotRow } from '../../lib/robots/storage';
import { INPUT_CLASS, SECONDARY_BUTTON } from '../auth/fields';
import { ConfirmInline, GHOST_BUTTON } from '../aula/MemberList';

export interface RobotListProps {
  readonly robots: readonly RobotRow[];
  /** Renames one robot; rejects when Supabase refuses it. */
  readonly onRename: (robot: RobotRow, name: string) => Promise<void>;
  readonly onDelete: (robot: RobotRow) => Promise<void>;
  /** Marks a `mobile-diff` robot as «Mi robot». */
  readonly onMakeDefault: (robot: RobotRow) => Promise<void>;
}

const CELL = 'px-4 py-2 align-middle';

/** Date of the row in the locale of the site, without a time. */
function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-ES');
}

interface RenameFormProps {
  readonly robot: RobotRow;
  readonly onRename: (name: string) => Promise<void>;
  readonly onCancel: () => void;
}

function RenameForm({ robot, onRename, onCancel }: RenameFormProps): JSX.Element {
  const t = useT();
  const [name, setName] = useState(robot.name);
  return (
    <form
      data-testid="rename-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onRename(name);
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <label htmlFor={`rename-${robot.id}`} className="sr-only">
        {t('auth.robots.renameLabel')}
      </label>
      <input
        id={`rename-${robot.id}`}
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={60}
        required
        className={`${INPUT_CLASS} max-w-[220px]`}
      />
      <button type="submit" className={SECONDARY_BUTTON}>
        {t('auth.robots.renameSave')}
      </button>
      <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
        {t('auth.robots.renameCancel')}
      </button>
    </form>
  );
}

interface RowActionsProps extends Omit<RobotListProps, 'robots'> {
  readonly robot: RobotRow;
  readonly onEdit: () => void;
}

interface DeleteActionProps {
  readonly robot: RobotRow;
  readonly onDelete: (robot: RobotRow) => Promise<void>;
}

/** «Eliminar» with an inline confirmation before it calls `onDelete` (audit finding 4, PR #174). */
function DeleteAction({ robot, onDelete }: DeleteActionProps): JSX.Element {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <ConfirmInline
        question={t('auth.robots.deleteConfirm', { name: robot.name })}
        yes={t('auth.robots.delete')}
        no={t('auth.robots.renameCancel')}
        onConfirm={() => void onDelete(robot)}
        onCancel={() => setConfirming(false)}
      />
    );
  }
  return (
    <button
      type="button"
      data-testid="delete-robot"
      onClick={() => setConfirming(true)}
      aria-label={t('auth.robots.delete')}
      className={GHOST_BUTTON}
    >
      {t('auth.robots.delete')}
    </button>
  );
}

function RowActions({ robot, onEdit, onDelete, onMakeDefault }: RowActionsProps): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {robot.kind === MOBILE_KIND && !robot.isDefault ? (
        <button
          type="button"
          data-testid="make-default"
          onClick={() => void onMakeDefault(robot)}
          aria-label={t('auth.robots.makeDefault')}
          className={SECONDARY_BUTTON}
        >
          {t('auth.robots.makeDefault')}
        </button>
      ) : null}
      <button
        type="button"
        data-testid="rename-robot"
        onClick={onEdit}
        aria-label={t('auth.robots.rename')}
        className={SECONDARY_BUTTON}
      >
        {t('auth.robots.rename')}
      </button>
      <DeleteAction robot={robot} onDelete={onDelete} />
    </div>
  );
}

interface RobotItemProps extends Omit<RobotListProps, 'robots'> {
  readonly robot: RobotRow;
}

interface NameCellProps {
  readonly robot: RobotRow;
  readonly editing: boolean;
  readonly onRename: (name: string) => Promise<void>;
  readonly onCancel: () => void;
}

/** The name, with the «Mi robot» mark, or the rename form while it is open. */
function NameCell({ robot, editing, onRename, onCancel }: NameCellProps): JSX.Element {
  const t = useT();
  if (editing) return <RenameForm robot={robot} onRename={onRename} onCancel={onCancel} />;
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span data-testid="robot-name">{robot.name}</span>
      {robot.isDefault ? (
        <span
          data-testid="robot-default"
          className="border-primary text-primary rounded-sm border px-2 font-mono text-xs"
        >
          {t('auth.robots.defaultMark')}
        </span>
      ) : null}
    </span>
  );
}

function KindCell({ robot }: { readonly robot: RobotRow }): JSX.Element {
  const t = useT();
  return (
    <>
      {robot.kind === MOBILE_KIND
        ? t('auth.robots.kind.mobile-diff')
        : t('auth.robots.kind.arm-serial')}
    </>
  );
}

function RobotItem({ robot, onRename, onDelete, onMakeDefault }: RobotItemProps): JSX.Element {
  const [editing, setEditing] = useState(false);
  return (
    <tr
      data-testid="robot-row"
      data-robot={robot.id}
      data-kind={robot.kind}
      className="border-border border-t"
    >
      <td className={CELL}>
        <NameCell
          robot={robot}
          editing={editing}
          onRename={async (name) => {
            await onRename(robot, name);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </td>
      <td className={`${CELL} text-fg-muted font-mono text-xs`}>
        <KindCell robot={robot} />
      </td>
      <td className={`${CELL} text-fg-muted font-mono text-xs tabular-nums`}>
        {formatDate(robot.createdAt)}
      </td>
      <td className={CELL}>
        <RowActions
          robot={robot}
          onEdit={() => setEditing(true)}
          onRename={onRename}
          onDelete={onDelete}
          onMakeDefault={onMakeDefault}
        />
      </td>
    </tr>
  );
}

const COLUMN_KEYS = ['name', 'kind', 'created', 'actions'] as const;

/** The four column headings, in the order the rows render their cells. */
function HeadRow(): JSX.Element {
  const t = useT();
  const labels: Readonly<Record<(typeof COLUMN_KEYS)[number], string>> = {
    name: t('auth.robots.columnName'),
    kind: t('auth.robots.columnKind'),
    created: t('auth.robots.columnCreated'),
    actions: t('auth.robots.columnActions'),
  };
  return (
    <tr className="text-sm font-semibold">
      {COLUMN_KEYS.map((key) => (
        <th key={key} scope="col" className={CELL}>
          {labels[key]}
        </th>
      ))}
    </tr>
  );
}

/** The learner's saved robots as the table of docs/DESIGN.md §5 (F3-04). */
export function RobotList({
  robots,
  onRename,
  onDelete,
  onMakeDefault,
}: RobotListProps): JSX.Element {
  const t = useT();
  if (robots.length === 0) {
    return (
      <p data-testid="robots-empty" className="text-fg-muted m-0">
        {t('auth.robots.empty')}
      </p>
    );
  }
  return (
    <div className="border-border bg-bg-raised rounded-lg overflow-auto border">
      <table data-testid="robot-list" className="w-full border-collapse text-left">
        <caption className="sr-only">{t('auth.robots.listTitle')}</caption>
        <thead>
          <HeadRow />
        </thead>
        <tbody>
          {robots.map((robot) => (
            <RobotItem
              key={robot.id}
              robot={robot}
              onRename={onRename}
              onDelete={onDelete}
              onMakeDefault={onMakeDefault}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
