import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './types';

export type DbClient = SupabaseClient<Database>;

type PublicEnvName = 'PUBLIC_SUPABASE_URL' | 'PUBLIC_SUPABASE_ANON_KEY';

function readPublicEnv(name: PublicEnvName): string {
  const value = import.meta.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is not set; copy .env.example to .env (docs/ops/SUPABASE.md).`);
  }
  return value;
}

let client: DbClient | undefined;

/**
 * The typed Supabase client for the browser, built lazily from the public URL and anon key so
 * that importing this package never requires the environment at build time. RLS is the only
 * access control: this client never holds the service_role key.
 */
export function getDbClient(): DbClient {
  client ??= createClient<Database>(
    readPublicEnv('PUBLIC_SUPABASE_URL'),
    readPublicEnv('PUBLIC_SUPABASE_ANON_KEY'),
  );
  return client;
}
