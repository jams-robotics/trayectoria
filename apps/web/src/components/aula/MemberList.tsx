import { useT, type Translate } from '@trayectoria/i18n';
import { useState, type JSX } from 'react';

import type { Member } from '../../lib/aula/groups';
import { SECONDARY_BUTTON } from '../auth/fields';

/** Low-priority action of docs/DESIGN.md §5 (Botón fantasma), 44 px tall for touch (§9 point 3). */
export const GHOST_BUTTON =
  'text-fg-muted hover:text-fg rounded-md inline-flex h-[44px] items-center px-3 font-semibold';

export interface ConfirmInlineProps {
  readonly question: string;
  readonly yes: string;
  readonly no: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** Inline confirmation: question, a secondary "yes" and a ghost "no" (F3-02a). */
export function ConfirmInline({
  question,
  yes,
  no,
  onConfirm,
  onCancel,
}: ConfirmInlineProps): JSX.Element {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-fg-muted text-sm">{question}</span>
      <button type="button" onClick={onConfirm} aria-label={yes} className={SECONDARY_BUTTON}>
        {yes}
      </button>
      <button type="button" onClick={onCancel} aria-label={no} className={GHOST_BUTTON}>
        {no}
      </button>
    </span>
  );
}

export interface MemberListProps {
  readonly members: readonly Member[];
  /** Removes one membership; the caller owns the Supabase call and the refresh. */
  readonly onRemove: (userId: string) => Promise<void>;
}

function formatJoinedAt(isoDate: string): string {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString('es');
}

/** The display name, or the "sin nombre" fallback when the profile is not readable. */
function memberName(t: Translate, member: Member): string {
  return member.displayName === '' ? t('aula.members.unknown') : member.displayName;
}

interface MemberRowProps {
  readonly member: Member;
  readonly confirming: boolean;
  readonly onAskRemove: () => void;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

function MemberIdentity({ member }: { readonly member: Member }): JSX.Element {
  const t = useT();
  return (
    <span className="flex flex-col">
      <span data-testid="member-name">{memberName(t, member)}</span>
      <span className="text-fg-muted text-sm">
        {t('aula.members.joinedAt', { date: formatJoinedAt(member.joinedAt) })}
      </span>
    </span>
  );
}

function MemberRow({
  member,
  confirming,
  onAskRemove,
  onCancel,
  onConfirm,
}: MemberRowProps): JSX.Element {
  const t = useT();
  const name = memberName(t, member);
  return (
    <li
      data-testid="member-row"
      data-user={member.userId}
      className="border-border flex min-h-[44px] flex-wrap items-center justify-between gap-3 border-b py-2 last:border-b-0"
    >
      <MemberIdentity member={member} />
      {confirming ? (
        <ConfirmInline
          question={t('aula.members.removeConfirm', { name })}
          yes={t('aula.members.removeYes')}
          no={t('aula.members.removeNo')}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      ) : (
        <button
          type="button"
          onClick={onAskRemove}
          aria-label={t('aula.members.remove', { name })}
          className={GHOST_BUTTON}
        >
          {t('aula.members.remove', { name })}
        </button>
      )}
    </li>
  );
}

/** Members of a group with an inline confirmation before removing one (F3-02a). */
export function MemberList({ members, onRemove }: MemberListProps): JSX.Element {
  const t = useT();
  const [confirmingId, setConfirmingId] = useState('');
  return (
    <section className="border-border bg-bg-raised rounded-lg border p-6">
      <h2 className="text-base font-semibold">{t('aula.members.title')}</h2>
      {members.length === 0 ? (
        <p data-testid="members-empty" className="text-fg-muted mt-3 mb-0">
          {t('aula.members.empty')}
        </p>
      ) : (
        <ul data-testid="member-list" className="m-0 mt-3 list-none p-0">
          {members.map((member) => (
            <MemberRow
              key={member.userId}
              member={member}
              confirming={confirmingId === member.userId}
              onAskRemove={() => setConfirmingId(member.userId)}
              onCancel={() => setConfirmingId('')}
              onConfirm={() => {
                setConfirmingId('');
                void onRemove(member.userId);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
