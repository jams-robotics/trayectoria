import { useT, type Translate } from '@trayectoria/i18n';
import { Toast } from '@trayectoria/widgets';
import { useCallback, useEffect, useState, type JSX } from 'react';

import { leaveGroup, listMyGroups, type MyGroup } from '../../lib/aula/membership';
import { ConfirmInline, GHOST_BUTTON } from '../aula/MemberList';
import { SECONDARY_BUTTON } from './fields';

export interface MyGroupsProps {
  readonly userId: string;
}

type Phase = 'loading' | 'ready' | 'error';

/** The group name, or the "sin nombre" fallback when `groups_visible` returns no row. */
function groupName(t: Translate, group: MyGroup): string {
  return group.name === '' ? t('auth.groups.unknown') : group.name;
}

interface GroupRowProps {
  readonly group: MyGroup;
  readonly confirming: boolean;
  readonly onAskLeave: () => void;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

function GroupRow({
  group,
  confirming,
  onAskLeave,
  onCancel,
  onConfirm,
}: GroupRowProps): JSX.Element {
  const t = useT();
  const name = groupName(t, group);
  return (
    <li
      data-testid="my-group-row"
      data-group={group.id}
      className="border-border flex min-h-[44px] flex-wrap items-center justify-between gap-3 border-b py-2 last:border-b-0"
    >
      <span data-testid="my-group-name">{name}</span>
      {confirming ? (
        <ConfirmInline
          question={t('auth.groups.leaveConfirm', { name })}
          yes={t('auth.groups.leaveYes')}
          no={t('auth.groups.leaveNo')}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      ) : (
        <button
          type="button"
          onClick={onAskLeave}
          aria-label={t('auth.groups.leave', { name })}
          className={GHOST_BUTTON}
        >
          {t('auth.groups.leave', { name })}
        </button>
      )}
    </li>
  );
}

interface GroupsState {
  readonly groups: readonly MyGroup[];
  readonly phase: Phase;
  readonly refresh: () => Promise<void>;
}

function useMyGroups(userId: string): GroupsState {
  const [groups, setGroups] = useState<readonly MyGroup[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const refresh = useCallback(async (): Promise<void> => {
    if (userId === '') return;
    try {
      setGroups(await listMyGroups(userId));
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, [userId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { groups, phase, refresh };
}

interface GroupListProps {
  readonly groups: readonly MyGroup[];
  readonly onLeave: (groupId: string) => void;
}

function GroupItems({ groups, onLeave }: GroupListProps): JSX.Element {
  const t = useT();
  const [confirmingId, setConfirmingId] = useState('');
  if (groups.length === 0) {
    return (
      <p data-testid="my-groups-empty" className="text-fg-muted mt-3 mb-0">
        {t('auth.groups.empty')}
      </p>
    );
  }
  return (
    <ul data-testid="my-group-list" className="m-0 mt-3 list-none p-0">
      {groups.map((group) => (
        <GroupRow
          key={group.id}
          group={group}
          confirming={confirmingId === group.id}
          onAskLeave={() => setConfirmingId(group.id)}
          onCancel={() => setConfirmingId('')}
          onConfirm={() => {
            setConfirmingId('');
            onLeave(group.id);
          }}
        />
      ))}
    </ul>
  );
}

/**
 * "Mis grupos" of `/cuenta` (F3-03): the groups the student belongs to, read from
 * `group_members` with the names of `groups_visible` — never the invite code — and a "Salir"
 * with an inline confirmation that deletes their own membership and refreshes the list.
 */
export function MyGroups({ userId }: MyGroupsProps): JSX.Element {
  const t = useT();
  const { groups, phase, refresh } = useMyGroups(userId);
  const [toast, setToast] = useState('');

  const leave = (groupId: string): void => {
    void leaveGroup(groupId, userId)
      .then(async () => {
        setToast(t('auth.groups.left'));
        await refresh();
      })
      .catch(() => setToast(t('auth.groups.leaveFailed')));
  };

  return (
    <section
      data-testid="my-groups"
      className="border-border bg-bg-raised rounded-lg border p-6"
      aria-labelledby="my-groups-title"
    >
      <h2 id="my-groups-title" className="text-base font-semibold">
        {t('auth.groups.title')}
      </h2>
      {phase === 'ready' ? (
        <GroupItems groups={groups} onLeave={leave} />
      ) : (
        <p
          aria-live="polite"
          role={phase === 'error' ? 'alert' : undefined}
          className={phase === 'error' ? 'text-error mt-3 mb-0' : 'text-fg-muted mt-3 mb-0'}
        >
          {phase === 'error' ? t('auth.groups.error') : t('auth.groups.loading')}
        </p>
      )}
      <a href="/unirse" className={`${SECONDARY_BUTTON} mt-5 no-underline`}>
        {t('auth.groups.join')}
      </a>
      {toast !== '' ? <Toast message={toast} onClose={() => setToast('')} /> : null}
    </section>
  );
}
