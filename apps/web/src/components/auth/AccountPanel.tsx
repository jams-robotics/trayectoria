import { signOut, useSession } from '@trayectoria/auth';
import { getDbClient, type Tables } from '@trayectoria/db';
import { useT } from '@trayectoria/i18n';
import { useEffect, useState, type JSX } from 'react';

import { DeleteAccount } from './DeleteAccount';
import { MyGroups } from './MyGroups';
import { SECONDARY_BUTTON } from './fields';

type Profile = Pick<Tables<'profiles'>, 'display_name' | 'role'>;

// Reads the caller's own profile row; RLS only returns it to its owner (migration 0002).
async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await getDbClient()
    .from('profiles')
    .select('display_name, role')
    .eq('id', userId)
    .maybeSingle();
  return data;
}

function useProfile(userId: string): Profile | null {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    if (userId === '') return;
    let cancelled = false;
    void fetchProfile(userId).then((row) => {
      if (!cancelled) setProfile(row);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return profile;
}

interface FieldProps {
  readonly label: string;
  readonly value: string;
  readonly testId: string;
}

function Field({ label, value, testId }: FieldProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-fg-muted font-mono text-xs tracking-[0.06em] uppercase">{label}</dt>
      <dd data-testid={testId} className="m-0">
        {value}
      </dd>
    </div>
  );
}

interface ProfileFieldsProps {
  readonly profile: Profile;
  readonly email: string;
}

function ProfileFields({ profile, email }: ProfileFieldsProps): JSX.Element {
  const t = useT();
  const role = profile.role === 'teacher' ? t('auth.roles.teacher') : t('auth.roles.student');
  return (
    <dl className="m-0 flex flex-col gap-4">
      <Field
        label={t('auth.account.displayName')}
        value={profile.display_name}
        testId="account-display-name"
      />
      <Field label={t('auth.account.email')} value={email} testId="account-email" />
      <Field label={t('auth.account.role')} value={role} testId="account-role" />
    </dl>
  );
}

// Rendered inside <AuthGate client:load> on /cuenta, so it only mounts with a session.
export function AccountPanel(): JSX.Element {
  const t = useT();
  const { session } = useSession();
  const profile = useProfile(session?.user.id ?? '');
  if (session === null) return <></>;
  return (
    <div className="flex flex-col gap-7">
      <div className="border-border bg-bg-raised rounded-md border p-7">
        {profile === null ? (
          <p aria-live="polite" className="text-fg-muted m-0">
            {t('auth.account.loading')}
          </p>
        ) : (
          <ProfileFields profile={profile} email={session.user.email ?? ''} />
        )}
        <div className="mt-6">
          <button type="button" onClick={() => void signOut()} className={SECONDARY_BUTTON}>
            {t('auth.account.signOut')}
          </button>
        </div>
      </div>
      {/* «Mis grupos» and «Eliminar cuenta» (F3-03); the latter closes the page. */}
      <MyGroups userId={session.user.id} />
      <DeleteAccount />
    </div>
  );
}
