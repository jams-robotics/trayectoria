import { AuthGate, useSession, type AuthGateCta } from '@trayectoria/auth';
import { getDbClient } from '@trayectoria/db';
import { useT } from '@trayectoria/i18n';
import { useCallback, useEffect, useState, type JSX } from 'react';

import { createGroup, listGroups, type Group } from '../../lib/aula/groups';
import { SECONDARY_BUTTON } from '../auth/fields';
import { CreateGroupForm } from './CreateGroupForm';
import { GroupDetail } from './GroupDetail';
import { GroupList } from './GroupList';

export interface AulaIslandProps {
  readonly cta: AuthGateCta;
}

/** Query-string parameter that turns the list into the detail: `/aula?grupo=<uuid>`. */
const GROUP_PARAM = 'grupo';

function readGroupParam(): string {
  return new URLSearchParams(window.location.search).get(GROUP_PARAM) ?? '';
}

/**
 * `output: 'static'` cannot prerender `/aula/[groupId]`, so the detail lives on the same page
 * with the group in the query string; `pushState` keeps the link copyable and the back button
 * working (ticket F3-02a, decision 4).
 */
function useGroupParam(): [string, (groupId: string) => void] {
  const [groupId, setGroupId] = useState('');
  useEffect(() => {
    setGroupId(readGroupParam());
    const onPopState = (): void => setGroupId(readGroupParam());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const navigate = useCallback((next: string): void => {
    const url = next === '' ? '/aula' : `/aula?${GROUP_PARAM}=${encodeURIComponent(next)}`;
    window.history.pushState({}, '', url);
    setGroupId(next);
  }, []);
  return [groupId, navigate];
}

/** Reads the caller's own role; RLS only returns their own profile row (migration 0002). */
async function fetchRole(userId: string): Promise<string> {
  const { data } = await getDbClient()
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return data?.role ?? '';
}

interface BackButtonProps {
  readonly onBack: () => void;
}

function BackButton({ onBack }: BackButtonProps): JSX.Element {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label={t('aula.groups.back')}
      className={SECONDARY_BUTTON}
    >
      {t('aula.groups.back')}
    </button>
  );
}

function NotFound({ onBack }: BackButtonProps): JSX.Element {
  const t = useT();
  return (
    <div data-testid="group-not-found">
      <p role="alert" className="text-error m-0">
        {t('aula.groups.notFound')}
      </p>
      <div className="mt-4">
        <BackButton onBack={onBack} />
      </div>
    </div>
  );
}

interface DetailPaneProps {
  readonly ownerId: string;
  readonly group: Group;
  readonly onChanged: () => Promise<void>;
  readonly onBack: () => void;
}

function DetailPane({ ownerId, group, onChanged, onBack }: DetailPaneProps): JSX.Element {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 data-testid="group-title" className="text-xl leading-tight m-0 font-semibold">
          {group.name}
        </h2>
        <BackButton onBack={onBack} />
      </div>
      <GroupDetail ownerId={ownerId} group={group} onChanged={onChanged} onDeleted={onBack} />
    </>
  );
}

type Phase = 'loading' | 'ready' | 'error';

interface GroupsState {
  readonly groups: readonly Group[];
  readonly phase: Phase;
  readonly refresh: () => Promise<void>;
}

function useGroups(ownerId: string): GroupsState {
  const [groups, setGroups] = useState<readonly Group[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const refresh = useCallback(async (): Promise<void> => {
    try {
      setGroups(await listGroups(ownerId));
      setPhase('ready');
    } catch {
      setPhase('error');
    }
  }, [ownerId]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { groups, phase, refresh };
}

function Phasing({ phase }: { readonly phase: Phase }): JSX.Element {
  const t = useT();
  const loading = phase === 'loading';
  return (
    <p
      aria-live="polite"
      role={loading ? undefined : 'alert'}
      className={loading ? 'text-fg-muted m-0' : 'text-error m-0'}
    >
      {loading ? t('aula.loading') : t('aula.error')}
    </p>
  );
}

interface ClassroomProps {
  readonly ownerId: string;
}

function Classroom({ ownerId }: ClassroomProps): JSX.Element {
  const { groups, phase, refresh } = useGroups(ownerId);
  const [creating, setCreating] = useState(false);
  const [groupId, navigate] = useGroupParam();

  if (phase !== 'ready') return <Phasing phase={phase} />;

  const selected = groups.find((group) => group.id === groupId) ?? null;
  const back = (): void => {
    navigate('');
    void refresh();
  };

  return (
    <div className="grid gap-7 md:grid-cols-[280px_minmax(0,1fr)]">
      <GroupList
        groups={groups}
        onOpen={navigate}
        onNew={() => setCreating(true)}
        creating={creating}
      />
      <div className="flex flex-col gap-5">
        {creating ? (
          <CreateGroupForm
            onCreate={async (name) => {
              const group = await createGroup(ownerId, name);
              setCreating(false);
              await refresh();
              navigate(group.id);
            }}
            onCancel={() => setCreating(false)}
          />
        ) : null}
        {groupId !== '' && selected === null ? <NotFound onBack={back} /> : null}
        {selected !== null ? (
          <DetailPane ownerId={ownerId} group={selected} onChanged={refresh} onBack={back} />
        ) : null}
      </div>
    </div>
  );
}

/** Role guard: only a `teacher` profile sees the classroom (ticket F3-02a, decision 3). */
function AulaPanel(): JSX.Element {
  const t = useT();
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (userId === '') return;
    let cancelled = false;
    void fetchRole(userId).then((value) => {
      if (!cancelled) setRole(value);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (session === null) return <></>;
  if (role === null) {
    return (
      <p aria-live="polite" className="text-fg-muted m-0">
        {t('aula.loading')}
      </p>
    );
  }
  if (role !== 'teacher') {
    return (
      <section
        data-testid="aula-only-teachers"
        className="border-border bg-bg-raised rounded-lg border p-6"
      >
        <p className="m-0">{t('aula.onlyTeachers')}</p>
        <a href="/cuenta" className={`${SECONDARY_BUTTON} mt-5 no-underline`}>
          {t('aula.goToAccount')}
        </a>
      </section>
    );
  }
  return <Classroom ownerId={userId} />;
}

/**
 * The one island of `/aula`, hydrated with `client:load` (docs/ARCHITECTURE.md §3.1). Like
 * `Account`, the panel is a plain child of `AuthGate` and not a nested island, which would be
 * server-rendered without a session and hydrated with one.
 */
export function AulaIsland({ cta }: AulaIslandProps): JSX.Element {
  return (
    <AuthGate cta={cta}>
      <AulaPanel />
    </AuthGate>
  );
}
