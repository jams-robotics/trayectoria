import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@trayectoria/db';

/**
 * Supabase helper for the e2e tests (F3-02a): creates users and joins groups from Node, without
 * driving the browser, so a test can set up several students in a few milliseconds. Reused by
 * F3-02b and F3-03.
 *
 * It only ever uses the **anon** key of the local stack: every call goes through RLS and through
 * `join_group`, exactly like the browser. There is no `service_role` here and there must not be.
 * Email confirmations are disabled locally (supabase/config.toml), so sign-up returns a session.
 */

const ENV_NAMES = ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_ANON_KEY'] as const;

/** The public URL and anon key, from the shell or from the local defaults of `.env.example`. */
function publicEnv(): Record<string, string> {
  const file = readFileSync(path.resolve(import.meta.dirname, '../../../../.env.example'), 'utf8');
  const defaults = Object.fromEntries(
    file
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  ) as Record<string, string>;
  return Object.fromEntries(
    ENV_NAMES.map((name) => [name, process.env[name] ?? defaults[name] ?? '']),
  );
}

/** The anon client these helpers hand out, typed with the generated schema. */
export type TestClient = SupabaseClient<Database>;

/** A fresh anon client; each caller gets its own so sessions do not overwrite each other. */
export function anonClient(): TestClient {
  const env = publicEnv();
  return createClient<Database>(
    env['PUBLIC_SUPABASE_URL'] ?? '',
    env['PUBLIC_SUPABASE_ANON_KEY'] ?? '',
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export type Role = 'student' | 'teacher';

export interface TestUser {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly userId: string;
  /** Signed in as this user; every statement runs under their own RLS context. */
  readonly client: TestClient;
}

/** The password every e2e user shares; the local stack requires at least six characters. */
export const E2E_PASSWORD = 'trayectoria-e2e-2026';

/** Creates an account with the given role and returns it already signed in. */
export async function signUp(role: Role, displayName: string, email: string): Promise<TestUser> {
  const client = anonClient();
  const { data, error } = await client.auth.signUp({
    email,
    password: E2E_PASSWORD,
    options: { data: { display_name: displayName, role } },
  });
  if (error !== null) throw new Error(`sign-up failed: ${error.message}`);
  const userId = data.user?.id;
  if (userId === undefined) throw new Error('sign-up returned no user');
  return { email, password: E2E_PASSWORD, displayName, userId, client };
}

/** Signs an existing account in on a fresh client. */
export async function signIn(email: string, password = E2E_PASSWORD): Promise<TestClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error !== null) throw new Error(`sign-in failed: ${error.message}`);
  return client;
}

/**
 * Joins a group through `public.join_group`, the `security definer` function of migration 0003:
 * the only path a student has into `group_members`. Returns the group id.
 */
export async function joinGroup(client: TestClient, code: string): Promise<string> {
  const { data, error } = await client.rpc('join_group', { invite_code: code });
  if (error !== null) throw new Error(`join_group failed: ${error.message}`);
  return typeof data === 'string' ? data : '';
}
