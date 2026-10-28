import { useSession } from '@trayectoria/auth';
import { useT } from '@trayectoria/i18n';
import { useState, type JSX } from 'react';

import { joinUrl, type OpenSession, type Participant } from '../../lib/aula/classSession';
import type { Group } from '../../lib/aula/groups';
import type { RemoteBus } from '../../lib/aula/remoteControl';
import { useClassroom, useTeacherGroups, type Classroom } from './useClassroom';

const BUTTON =
  'min-h-10 rounded-md border border-border bg-bg px-3 text-sm font-semibold text-fg hover:border-primary disabled:opacity-60';
const PRIMARY = 'min-h-10 rounded-md bg-primary px-3 text-sm font-semibold text-primary-fg';

/** No QR library in the repo (no new dependencies): the link is shown big and can be copied. */
function SessionLink({ session }: { session: OpenSession }): JSX.Element {
  const t = useT();
  const [note, setNote] = useState('');
  const url = joinUrl(window.location.origin, session.token);
  const copy = (): void => {
    navigator.clipboard.writeText(url).then(
      () => setNote(t('aula.session.teacher.copied')),
      () => setNote(t('aula.session.teacher.copyUnavailable')),
    );
  };
  const time = new Date(session.expiresAt).toLocaleTimeString([], { timeStyle: 'short' });
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="aula-link" className="text-sm font-medium">
        {t('aula.session.teacher.link')}
      </label>
      <textarea
        id="aula-link"
        data-testid="aula-link"
        readOnly
        rows={3}
        value={url}
        className="w-full break-all rounded-md border border-border bg-bg p-2 font-mono text-base text-fg"
      />
      <div className="flex items-center gap-3">
        <button type="button" className={BUTTON} onClick={copy}>
          {t('aula.session.teacher.copy')}
        </button>
        <span className="text-xs text-fg-muted">
          {note !== '' ? note : t('aula.session.teacher.expires', { time })}
        </span>
      </div>
    </div>
  );
}

function Row({ person, room }: { person: Participant; room: Classroom }): JSX.Element {
  const t = useT();
  const driving = room.activeId === person.userId;
  const state = driving ? 'driving' : person.status === 'pending' ? 'pending' : 'approved';
  return (
    <li data-testid="aula-participant" data-status={person.status} className="flex flex-col gap-1">
      <span className="text-sm">
        {person.name}
        <span className="ml-2 text-xs text-fg-muted">{t(`aula.session.teacher.${state}`)}</span>
      </span>
      <div className="flex flex-wrap gap-2">
        {person.status === 'pending' ? (
          <button type="button" className={PRIMARY} onClick={() => room.approve(person.userId)}>
            {t('aula.session.teacher.approve', { name: person.name })}
          </button>
        ) : (
          <button
            type="button"
            className={BUTTON}
            onClick={() => room.setActive(driving ? null : person.userId)}
          >
            {driving
              ? t('aula.session.teacher.release', { name: person.name })
              : t('aula.session.teacher.drive', { name: person.name })}
          </button>
        )}
        <button type="button" className={BUTTON} onClick={() => room.kick(person.userId)}>
          {t('aula.session.teacher.kick', { name: person.name })}
        </button>
      </div>
    </li>
  );
}

function People({ room }: { room: Classroom }): JSX.Element {
  const t = useT();
  const people = room.participants.filter((person) => person.status !== 'kicked');
  return (
    <section aria-label={t('aula.session.teacher.participants')}>
      <h3 className="text-sm font-semibold">{t('aula.session.teacher.participants')}</h3>
      {people.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('aula.session.teacher.none')}</p>
      ) : (
        <ul className="m-0 mt-2 flex list-none flex-col gap-3 p-0">
          {people.map((person) => (
            <Row key={person.userId} person={person} room={room} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LastCommand({ room }: { room: Classroom }): JSX.Element {
  const t = useT();
  const { last } = room;
  const text =
    last?.kind === 'drive' ? `${last.steer} · ${last.go}` : t('aula.session.teacher.idle');
  return (
    <p className="m-0 font-mono text-xs text-fg-muted">
      {`${t('aula.session.teacher.last')}: `}
      <span data-testid="aula-last">{text}</span>
    </p>
  );
}

function GroupPicker(props: {
  groups: readonly Group[];
  value: string;
  onChange: (id: string) => void;
}): JSX.Element | null {
  const t = useT();
  if (props.groups.length < 2) return null;
  return (
    <select
      aria-label={t('aula.session.teacher.group')}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
      className="min-h-10 rounded-md border border-border bg-bg px-2 text-sm"
    >
      {props.groups.map((group) => (
        <option key={group.id} value={group.id}>
          {group.name}
        </option>
      ))}
    </select>
  );
}

function Controls({ room, groupId }: { room: Classroom; groupId: string }): JSX.Element {
  const t = useT();
  if (room.session === null)
    return (
      <button type="button" className={PRIMARY} onClick={() => room.start(groupId)}>
        {t('aula.session.teacher.start')}
      </button>
    );
  return (
    <>
      <SessionLink session={room.session} />
      <People room={room} />
      <LastCommand room={room} />
      <button type="button" className={BUTTON} onClick={room.close}>
        {t('aula.session.teacher.close')}
      </button>
    </>
  );
}

function Body(props: { groups: readonly Group[]; bus: RemoteBus; userId: string }): JSX.Element {
  const t = useT();
  const [groupId, setGroupId] = useState(props.groups[0]?.id ?? '');
  const room = useClassroom(props.userId, groupId, props.bus);
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-fg-muted">{t('aula.session.teacher.intro')}</p>
      <GroupPicker groups={props.groups} value={groupId} onChange={setGroupId} />
      <Controls room={room} groupId={groupId} />
      {room.failed ? (
        <p role="alert" className="m-0 text-sm text-error">
          {t('aula.session.teacher.failed')}
        </p>
      ) : null}
    </div>
  );
}

/**
 * «Aula» of the 3D track: floats over the arena and exists only for a teacher with groups (a
 * student's RLS returns none). The arena reads the phones through `bus`.
 */
export function ClassroomPanel({ bus }: { bus: RemoteBus }): JSX.Element | null {
  const t = useT();
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const groups = useTeacherGroups(userId);
  const [open, setOpen] = useState(false);
  if (groups.length === 0) return null;
  return (
    <aside className="absolute bottom-12 left-4 z-20 w-panel max-w-[calc(100%-2rem)] rounded-lg border border-border bg-bg-raised/95 p-3 text-fg shadow-md backdrop-blur lg:bottom-4">
      <button
        type="button"
        data-testid="aula-toggle"
        aria-expanded={open}
        className={BUTTON}
        onClick={() => setOpen(!open)}
      >
        {t('aula.session.teacher.open')}
      </button>
      {open ? (
        <div className="mt-3 max-h-[60dvh] overflow-y-auto">
          <h2 className="mb-2 text-base font-semibold">{t('aula.session.teacher.title')}</h2>
          <Body groups={groups} bus={bus} userId={userId} />
        </div>
      ) : null}
    </aside>
  );
}
