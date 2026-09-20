import { useT } from '@trayectoria/i18n';
import { useCallback, useEffect, useState, type JSX } from 'react';

import {
  GROUP_NAME_MAX_LENGTH,
  deleteGroup,
  listMembers,
  regenerateInviteCode,
  removeMember,
  renameGroup,
  type Group,
  type Member,
} from '../../lib/aula/groups';
import { INPUT_CLASS, SECONDARY_BUTTON } from '../auth/fields';
import { InviteCode } from './InviteCode';
import { ConfirmInline, GHOST_BUTTON, MemberList } from './MemberList';

export interface GroupDetailProps {
  readonly ownerId: string;
  readonly group: Group;
  /** Re-reads the groups after a rename or a new code, so the list stays in step. */
  readonly onChanged: () => Promise<void>;
  /** Called after the group is deleted; the island goes back to the list. */
  readonly onDeleted: () => void;
}

interface DeleteBoxProps {
  readonly onDelete: () => void;
}

function DeleteBox({ onDelete }: DeleteBoxProps): JSX.Element {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={t('aula.detail.delete')}
        className={GHOST_BUTTON}
      >
        {t('aula.detail.delete')}
      </button>
    );
  }
  return (
    <ConfirmInline
      question={t('aula.detail.deleteConfirm')}
      yes={t('aula.detail.deleteYes')}
      no={t('aula.detail.deleteNo')}
      onConfirm={onDelete}
      onCancel={() => setConfirming(false)}
    />
  );
}

interface NameFormProps {
  readonly initialName: string;
  readonly onRename: (name: string) => void;
  readonly onDelete: () => void;
}

function NameForm({ initialName, onRename, onDelete }: NameFormProps): JSX.Element {
  const t = useT();
  const [name, setName] = useState(initialName);
  useEffect(() => setName(initialName), [initialName]);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onRename(name);
      }}
      className="border-border bg-bg-raised rounded-lg border p-6"
    >
      <label htmlFor="group-detail-name" className="font-medium">
        {t('aula.detail.name')}
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          id="group-detail-name"
          name="group-detail-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={GROUP_NAME_MAX_LENGTH}
          required
          className={`${INPUT_CLASS} max-w-[420px]`}
        />
        <button type="submit" aria-label={t('aula.detail.rename')} className={SECONDARY_BUTTON}>
          {t('aula.detail.rename')}
        </button>
        <DeleteBox onDelete={onDelete} />
      </div>
    </form>
  );
}

interface StatusLineProps {
  readonly error: string;
  readonly status: string;
}

function StatusLine({ error, status }: StatusLineProps): JSX.Element {
  return (
    <p aria-live="polite" data-testid="group-status" className="m-0 min-h-[1.5em]">
      {error !== '' ? (
        <span role="alert" className="text-error">
          {error}
        </span>
      ) : (
        <span className="text-success">{status}</span>
      )}
    </p>
  );
}

interface DetailState {
  readonly members: readonly Member[];
  readonly error: string;
  readonly status: string;
  readonly refreshMembers: () => Promise<void>;
  /** Runs one Supabase write and turns its outcome into the live-region status. */
  readonly run: (action: () => Promise<void>, message: string) => Promise<void>;
}

function useGroupDetail(groupId: string): DetailState {
  const t = useT();
  const [members, setMembers] = useState<readonly Member[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const refreshMembers = useCallback(async (): Promise<void> => {
    setMembers(await listMembers(groupId));
  }, [groupId]);

  useEffect(() => {
    let cancelled = false;
    void listMembers(groupId).then(
      (rows) => !cancelled && setMembers(rows),
      () => !cancelled && setError(t('aula.detail.failed')),
    );
    return () => {
      cancelled = true;
    };
  }, [groupId, t]);

  const run = useCallback(
    async (action: () => Promise<void>, message: string): Promise<void> => {
      setError('');
      setStatus('');
      try {
        await action();
        setStatus(message);
      } catch {
        setError(t('aula.detail.failed'));
      }
    },
    [t],
  );

  return { members, error, status, refreshMembers, run };
}

/** Detail of one group: editable name, invite code and members (F3-02a). */
export function GroupDetail({
  ownerId,
  group,
  onChanged,
  onDeleted,
}: GroupDetailProps): JSX.Element {
  const t = useT();
  const groupId = group.id;
  const { members, error, status, refreshMembers, run } = useGroupDetail(groupId);

  const rename = (name: string): void =>
    void run(async () => {
      await renameGroup(ownerId, groupId, name);
      await onChanged();
    }, t('aula.detail.renamed'));

  const drop = (): void =>
    void run(async () => {
      await deleteGroup(ownerId, groupId);
      onDeleted();
    }, '');

  const regenerate = (): Promise<void> =>
    run(async () => {
      await regenerateInviteCode(ownerId, groupId);
      await onChanged();
    }, '');

  const remove = (userId: string): Promise<void> =>
    run(async () => {
      await removeMember(groupId, userId);
      await refreshMembers();
      await onChanged();
    }, '');

  return (
    <div className="flex flex-col gap-5">
      <NameForm initialName={group.name} onRename={rename} onDelete={drop} />
      <InviteCode code={group.inviteCode} onRegenerate={regenerate} />
      <MemberList members={members} onRemove={remove} />
      <StatusLine error={error} status={status} />
    </div>
  );
}
