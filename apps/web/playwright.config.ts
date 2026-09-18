import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// E2E (F0-08) runs locally against the Supabase stack started with `supabase start`
// (docs/ops/SUPABASE.md). The web server is `astro dev` on a fixed port; the public Supabase
// variables default to the local values of .env.example when the shell does not set them.
const PORT = 4321;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const PUBLIC_ENV_NAMES = ['PUBLIC_SUPABASE_URL', 'PUBLIC_SUPABASE_ANON_KEY'] as const;

function readEnvExample(): Record<string, string> {
  const file = readFileSync(path.resolve(import.meta.dirname, '../../.env.example'), 'utf8');
  return Object.fromEntries(
    file
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function webServerEnv(): Record<string, string> {
  const defaults = readEnvExample();
  return {
    ...Object.fromEntries(
      PUBLIC_ENV_NAMES.map((name) => [name, process.env[name] ?? defaults[name] ?? '']),
    ),
    // Astro 7 detaches `astro dev` into a background daemon when it detects an AI agent shell
    // (am-i-vibing reads this variable). Playwright needs the server in the foreground to own it.
    CLAUDECODE: '',
  };
}

export default defineConfig({
  testDir: 'e2e',
  // Visual snapshots of /dev/widgets are committed as e2e/visual/<name>.png (F2-01a).
  snapshotPathTemplate: '{testDir}/visual/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // astro is called directly (no pnpm in between) so Playwright owns the process; --ignore-lock skips
    // the lock file of Astro 7, which a previous aborted run may have left behind.
    command: `node node_modules/astro/bin/astro.mjs dev --ignore-lock --host 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: webServerEnv(),
  },
});
