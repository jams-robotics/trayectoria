import { afterEach, describe, expect, it, vi } from 'vitest';

import type { getDbClient as GetDbClient } from './client';

const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_ANON_KEY = 'anon-key-for-tests';

async function freshGetDbClient(): Promise<typeof GetDbClient> {
  vi.resetModules();
  return (await import('./client')).getDbClient;
}

describe('getDbClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('throws a pointer to .env.example when the URL is missing', async () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', LOCAL_ANON_KEY);
    const getDbClient = await freshGetDbClient();
    expect(() => getDbClient()).toThrow(/PUBLIC_SUPABASE_URL is not set/);
  });

  it('throws a pointer to .env.example when the anon key is missing', async () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', LOCAL_URL);
    vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', '');
    const getDbClient = await freshGetDbClient();
    expect(() => getDbClient()).toThrow(/PUBLIC_SUPABASE_ANON_KEY is not set/);
  });

  it('builds one client from the public variables and reuses it', async () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', LOCAL_URL);
    vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', LOCAL_ANON_KEY);
    const getDbClient = await freshGetDbClient();
    const client = getDbClient();
    expect(getDbClient()).toBe(client);
    expect(client.storage.from('urdf')).toBeDefined();
  });
});
