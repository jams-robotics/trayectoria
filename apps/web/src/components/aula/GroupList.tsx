import { useT } from '@trayectoria/i18n';
import type { JSX } from 'react';

import type { Group } from '../../lib/aula/groups';
import { SECONDARY_BUTTON } from '../auth/fields';

export interface GroupListProps {
  readonly groups: readonly Group[];
  /** Opens the detail of a group; the island pushes `/aula?grupo=<id>` into the history. */
  readonly onOpen: (groupId: string) => void;
  readonly onNew: () => void;
  /** Hides the "Nuevo grupo" button while the create form is open. */
  readonly creating: boolean;
}

interface GroupItemProps {
  readonly group: Group;
  readonly onOpen: () => void;
}

function GroupItem({ group, onOpen }: GroupItemProps): JSX.Element {
  const t = useT();
  return (
    <li>
      <button
        type="button"
        data-testid="group-item"
        data-group={group.id}
        onClick={onOpen}
        aria-label={t('aula.groups.open', { name: group.name })}
        className="border-border bg-bg-raised hover:border-fg-muted flex min-h-[44px] w-full items-center justify-between gap-3 rounded-md border px-4 py-2 text-left"
      >
        <span>{group.name}</span>
        <span data-testid="group-member-count" className="text-fg-muted font-mono text-sm">
          {t('aula.groups.memberCount', { count: group.memberCount })}
        </span>
      </button>
    </li>
  );
}

/** Groups of the teacher with their member counts, plus the "Nuevo grupo" button (F3-02a). */
export function GroupList({ groups, onOpen, onNew, creating }: GroupListProps): JSX.Element {
  const t = useT();
  return (
    <section>
      <h2 className="text-fg-muted font-mono text-xs tracking-[0.06em] uppercase">
        {t('aula.groups.title')}
      </h2>
      {groups.length === 0 ? (
        <p data-testid="groups-empty" className="text-fg-muted mt-3">
          {t('aula.groups.empty')}
        </p>
      ) : (
        <ul data-testid="group-list" className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {groups.map((group) => (
            <GroupItem key={group.id} group={group} onOpen={() => onOpen(group.id)} />
          ))}
        </ul>
      )}
      {creating ? null : (
        <button
          type="button"
          onClick={onNew}
          aria-label={t('aula.groups.new')}
          className={`${SECONDARY_BUTTON} mt-3 w-full`}
        >
          {t('aula.groups.new')}
        </button>
      )}
    </section>
  );
}
