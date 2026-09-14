import { getDbClient, type DbClient } from '@trayectoria/db';

/** The auth API of the shared Supabase client: anon key plus RLS, never the service_role. */
export type AuthClient = DbClient['auth'];

// The session types are derived from the shared client so that this package does not declare a
// second @supabase/supabase-js dependency (docs/ARCHITECTURE.md §2: auth → db).
type GetSessionResult = Awaited<ReturnType<AuthClient['getSession']>>;

export type Session = NonNullable<GetSessionResult['data']['session']>;
export type User = Session['user'];
export type AuthError = NonNullable<GetSessionResult['error']>;

/** Returns the auth API of the one Supabase client built by `@trayectoria/db`. */
export function getAuthClient(): AuthClient {
  return getDbClient().auth;
}
