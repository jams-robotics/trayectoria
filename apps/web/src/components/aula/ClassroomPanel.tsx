import { useSession } from '@trayectoria/auth';
import { useT, type Translate } from '@trayectoria/i18n';
import { useEffect, useRef, useState, type JSX } from 'react';

import { joinUrl, type OpenSession, type Participant } from '../../lib/aula/classSession';
import type { Group } from '../../lib/aula/groups';
import type { RemoteBus } from '../../lib/aula/remoteControl';
import { QrCode } from './QrCode';
import { useClassroom, useTeacherGroups, type Classroom } from './useClassroom';

const BUTTON =
  'min-h-8 rounded-md border border-border bg-bg px-3 text-sm font-semibold text-fg hover:border-primary disabled:opacity-60';
const PRIMARY = 'min-h-9 rounded-md bg-primary px-3 text-sm font-semibold text-primary-fg';

/** The QR full screen over the arena, for a projector: the class scans it from their seats. */
function BigQr({ url, onClose }: { url: string; onClose: () => void }): JSX.Element {
  const t = useT();
  const dialog = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="aula-big-qr-title"
      onClose={onClose}
      className="m-auto max-h-[95dvh] w-[min(36rem,95vw)] rounded-lg border border-border bg-bg-raised p-6 text-fg shadow-md backdrop:bg-bg/80"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 id="aula-big-qr-title" className="m-0 text-xl font-semibold">
          {t('aula.session.teacher.scanTitle')}
        </h2>
        <div className="w-[min(26rem,70dvh,80vw)]">
          <QrCode text={url} label={t('aula.session.teacher.qr')} />
        </div>
        <p className="m-0 break-all font-mono text-sm text-fg-muted">{url}</p>
        <button type="button" className={BUTTON} onClick={() => dialog.current?.close()}>
          {t('aula.session.teacher.closeQr')}
        </button>
      </div>
    </dialog>
  );
}

function CopyLink({ url, expiresAt }: { url: string; expiresAt: string }): JSX.Element {
  const t = useT();
  const [note, setNote] = useState('');
  const copy = (): void => {
    navigator.clipboard.writeText(url).then(
      () => setNote(t('aula.session.teacher.copied')),
      () => setNote(t('aula.session.teacher.copyUnavailable')),
    );
  };
  const time = new Date(expiresAt).toLocaleTimeString([], { timeStyle: 'short' });
  return (
    <>
      <label htmlFor="aula-link" className="text-xs font-medium text-fg-muted">
        {t('aula.session.teacher.link')}
      </label>
      <div className="flex gap-2">
        <input
          id="aula-link"
          data-testid="aula-link"
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-8 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 font-mono text-xs text-fg"
        />
        <button type="button" className={BUTTON} onClick={copy}>
          {t('aula.session.teacher.copy')}
        </button>
      </div>
      <p className="m-0 text-xs text-fg-muted" aria-live="polite">
        {note !== '' ? note : t('aula.session.teacher.expires', { time })}
      </p>
    </>
  );
}

/** The join link as a QR code for the phones' cameras, with the three steps of a session. */
function SessionLink({ session }: { session: OpenSession }): JSX.Element {
  const t = useT();
  const [big, setBig] = useState(false);
  const url = joinUrl(window.location.origin, session.token);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-[7rem] shrink-0">
          <QrCode text={url} label={t('aula.session.teacher.qr')} />
        </div>
        <div className="flex flex-col gap-2">
          <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-sm">
            <li>{t('aula.session.teacher.howScan')}</li>
            <li>{t('aula.session.teacher.howApprove')}</li>
            <li>{t('aula.session.teacher.howDrive')}</li>
          </ol>
          <button type="button" className={PRIMARY} onClick={() => setBig(true)}>
            {t('aula.session.teacher.showQr')}
          </button>
        </div>
      </div>
      {big ? <BigQr url={url} onClose={() => setBig(false)} /> : null}
      <CopyLink url={url} expiresAt={session.expiresAt} />
    </div>
  );
}

const DOT: Readonly<Record<'driving' | 'pending' | 'approved', string>> = {
  driving: 'bg-success',
  pending: 'bg-warning',
  approved: 'bg-fg-muted',
};

/** Approve a pending student, or hand the wheel to an approved one (and take it back). */
function MainAction(props: {
  person: Participant;
  room: Classroom;
  driving: boolean;
}): JSX.Element {
  const t = useT();
  const { person, room, driving } = props;
  const name = { name: person.name };
  if (person.status === 'pending')
    return (
      <button
        type="button"
        className={PRIMARY}
        aria-label={t('aula.session.teacher.approve', name)}
        onClick={() => room.approve(person.userId)}
      >
        {t('aula.session.teacher.approveShort')}
      </button>
    );
  return (
    <button
      type="button"
      className={driving ? BUTTON : PRIMARY}
      aria-label={t(`aula.session.teacher.${driving ? 'release' : 'drive'}`, name)}
      onClick={() => room.setActive(driving ? null : person.userId)}
    >
      {t(`aula.session.teacher.${driving ? 'releaseShort' : 'driveShort'}`)}
    </button>
  );
}

function Row({ person, room }: { person: Participant; room: Classroom }): JSX.Element {
  const t = useT();
  const driving = room.activeId === person.userId;
  const state = driving ? 'driving' : person.status === 'pending' ? 'pending' : 'approved';
  return (
    <li
      data-testid="aula-participant"
      data-status={person.status}
      className={`flex flex-col gap-2 rounded-md border p-2 ${driving ? 'border-success' : 'border-border'}`}
    >
      <span className="flex items-center gap-2 text-sm">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT[state]}`} />
        <span className="font-medium">{person.name}</span>
        <span className="text-xs text-fg-muted">{t(`aula.session.teacher.${state}`)}</span>
      </span>
      <div className="flex flex-wrap gap-2">
        <MainAction person={person} room={room} driving={driving} />
        <button
          type="button"
          className={BUTTON}
          aria-label={t('aula.session.teacher.kick', { name: person.name })}
          onClick={() => room.kick(person.userId)}
        >
          {t('aula.session.teacher.kickShort')}
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
      className="min-h-8 rounded-md border border-border bg-bg px-2 text-sm"
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

function Body({ room, groups, groupId, onGroup }: BodyProps): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm text-fg-muted">{t('aula.session.teacher.intro')}</p>
      <GroupPicker groups={groups} value={groupId} onChange={onGroup} />
      <Controls room={room} groupId={groupId} />
      {room.failed ? (
        <p role="alert" className="m-0 text-sm text-error">
          {t('aula.session.teacher.failed')}
        </p>
      ) : null}
    </div>
  );
}

interface BodyProps {
  readonly room: Classroom;
  readonly groups: readonly Group[];
  readonly groupId: string;
  readonly onGroup: (id: string) => void;
}

/** What the closed toggle says: who drives, who waits, or that a session is open. */
function toggleText(t: Translate, room: Classroom): string {
  if (room.session === null) return t('aula.session.teacher.open');
  const driver = room.participants.find((person) => person.userId === room.activeId);
  if (driver !== undefined) return t('aula.session.teacher.toggleDriving', { name: driver.name });
  const pending = room.participants.filter((person) => person.status === 'pending').length;
  if (pending > 0) return t('aula.session.teacher.togglePending', { n: pending });
  return t('aula.session.teacher.toggleOpen');
}

/** The session lives here, so closing the panel to watch the track never drops the phones. */
function Room(props: { groups: readonly Group[]; bus: RemoteBus; userId: string }): JSX.Element {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState(props.groups[0]?.id ?? '');
  const room = useClassroom(props.userId, groupId, props.bus);
  // Handing the wheel closes the panel: the arena and its own buttons are what matter then.
  useEffect(() => {
    if (room.activeId !== null) setOpen(false);
  }, [room.activeId]);
  return (
    <aside
      className={`absolute bottom-12 left-4 z-20 ${open ? 'w-panel' : ''} max-w-[calc(100%-2rem)] rounded-lg border border-border bg-bg-raised/95 p-3 text-fg shadow-md backdrop-blur lg:bottom-4`}
    >
      <button
        type="button"
        data-testid="aula-toggle"
        aria-expanded={open}
        className={BUTTON}
        onClick={() => setOpen(!open)}
      >
        {open ? t('aula.session.teacher.open') : toggleText(t, room)}
      </button>
      <div hidden={!open} className="mt-3 max-h-[60dvh] overflow-x-hidden overflow-y-auto">
        <h2 className="mb-2 text-base font-semibold">{t('aula.session.teacher.title')}</h2>
        <Body room={room} groups={props.groups} groupId={groupId} onGroup={setGroupId} />
      </div>
    </aside>
  );
}

/**
 * «Aula» of the 3D track: floats over the arena and exists only for a teacher with groups (a
 * student's RLS returns none). The arena reads the phones through `bus`.
 */
export function ClassroomPanel({ bus }: { bus: RemoteBus }): JSX.Element | null {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const groups = useTeacherGroups(userId);
  if (groups.length === 0) return null;
  return <Room groups={groups} bus={bus} userId={userId} />;
}
