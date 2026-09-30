import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import auth from '../../../packages/i18n/locales/es/auth.json' with { type: 'json' };
import { E2E_PASSWORD, publicEnv, signUp } from './helpers/supabase';
import { makeZip, type ZipFile } from './helpers/zip';

// #507: security headers of every deployment. `public/_headers` (Cloudflare) and
// `infra/Caddyfile` (self-hosting) declare them; neither `astro dev` nor `astro preview` serves
// them, so the page tests add the CSP of `_headers` to each HTML response themselves and fail on
// any violation the browser reports. The CSP only lets inline scripts run by hash: the build scan
// names the hash of any inline script missing from it. Both need the build, which is what the web
// server serves with CI set (playwright.config.ts); `astro dev` injects scripts of its own, so
// locally they run with `CI=1 pnpm e2e`.

const WEB = path.resolve(import.meta.dirname, '..');
const HEADERS_FILE = path.join(WEB, 'public/_headers');
const CADDYFILE = path.resolve(WEB, '../../infra/Caddyfile');
const DIST = path.join(WEB, 'dist');
const CATALOG = path.resolve(WEB, '../../catalog/arms');
const SUPABASE_PLACEHOLDER = '__SUPABASE_ORIGINS__';
/** Cloudflare Web Analytics: only the Cloudflare deployment loads its beacon. */
const CLOUDFLARE_ANALYTICS = [
  'https://static.cloudflareinsights.com',
  'https://cloudflareinsights.com',
] as const;
const REQUIRED_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
} as const;
const AGAINST_BUILD = Boolean(process.env['CI']);
const BUILD_ONLY = 'needs the build that the web server serves with CI set';
/** Lazy islands pull three and the URDF loader in. */
const ISLAND_TIMEOUT_MS = 30_000;

/** The headers of the `/*` rule of `public/_headers`. */
function cloudflareHeaders(): Map<string, string> {
  const headers = new Map<string, string>();
  let inRule = false;
  for (const line of readFileSync(HEADERS_FILE, 'utf8').split('\n')) {
    if (line.startsWith('#') || line.trim() === '') continue;
    if (!line.startsWith(' ')) {
      inRule = line.trim() === '/*';
      continue;
    }
    const separator = line.indexOf(':');
    if (inRule) headers.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return headers;
}

/** The headers of the `(security_headers)` snippet of `infra/Caddyfile`. */
function caddyHeaders(): Map<string, string> {
  const headers = new Map<string, string>();
  for (const match of readFileSync(CADDYFILE, 'utf8').matchAll(/^\t\t([A-Za-z-]+) "(.*)"$/gm)) {
    headers.set(match[1] ?? '', match[2] ?? '');
  }
  return headers;
}

function directive(csp: string, name: string): string[] {
  const found = csp
    .split(';')
    .map((part) => part.trim().split(/\s+/))
    .find(([directiveName]) => directiveName === name);
  return found?.slice(1) ?? [];
}

/** The CSP as a deployment sends it for the local Supabase stack the tests run against. */
function localCsp(): string {
  const origin = new URL(publicEnv()['PUBLIC_SUPABASE_URL'] ?? '').origin;
  const csp = cloudflareHeaders().get('Content-Security-Policy') ?? '';
  return csp.replace(SUPABASE_PLACEHOLDER, `${origin} ${origin.replace(/^http/, 'ws')}`);
}

/**
 * Sends every HTML page with the CSP and returns the violations the browser reports: Chromium
 * logs each refused load or script in the console, and the page reports the event itself too.
 *
 * The one violation left out is Zod 4's probe: once per page it runs `Function('')` inside a
 * try/catch to decide whether to compile its validators, and without 'unsafe-eval' it falls back
 * to interpreting them. Any other eval throws an `EvalError`, which is collected instead.
 */
async function withCsp(page: Page): Promise<string[]> {
  const violations: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('Content Security Policy') || text.startsWith('csp-violation')) {
      violations.push(text);
    }
  });
  page.on('pageerror', (error) => {
    if (error.name === 'EvalError') violations.push(error.message);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      if (event.blockedURI === 'eval') return;
      console.error(
        `csp-violation ${event.effectiveDirective} ${event.blockedURI} ${event.sourceFile}`,
      );
    });
  });
  const csp = localCsp();
  const site = new URL(test.info().project.use.baseURL ?? '').origin;
  // A page fulfilled by the test no longer counts as loopback for Chromium's Local Network Access,
  // which would then block its requests to the local Supabase stack; a deployment never hits this.
  await page.context().grantPermissions(['local-network-access']);
  // Only the site's own requests are intercepted: Supabase's go straight to the local stack.
  await page.route(
    (url) => url.origin === site,
    async (route) => {
      if (route.request().resourceType() !== 'document') {
        await route.fallback();
        return;
      }
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), 'content-security-policy': csp },
      });
    },
  );
  return violations;
}

/**
 * Waits until every island has hydrated. The `client:visible` ones hydrate when they intersect the
 * viewport, so each poll brings the first pending island into view: a single scroll through the
 * page misses the ones that the `client:only` widgets push further down as they render.
 */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(
    () => {
      const pending = document.querySelectorAll('astro-island[ssr]');
      pending[0]?.scrollIntoView();
      return pending.length === 0;
    },
    undefined,
    { polling: 250, timeout: ISLAND_TIMEOUT_MS },
  );
  await page.waitForLoadState('networkidle');
}

function uniqueEmail(prefix: string): string {
  return `${prefix}+${Date.now()}-${test.info().workerIndex}@example.com`;
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(file);
    return entry.name.endsWith('.html') ? [file] : [];
  });
}

/** The SO-101 zip: its URDF and every mesh, which the simulator reads from object URLs. */
function so101Zip(): Uint8Array {
  const root = path.join(CATALOG, 'so101');
  const files: ZipFile[] = [
    { path: 'so101.urdf', bytes: new Uint8Array(readFileSync(path.join(root, 'so101.urdf'))) },
  ];
  for (const name of readdirSync(path.join(root, 'meshes'))) {
    files.push({
      path: `meshes/${name}`,
      bytes: new Uint8Array(readFileSync(path.join(root, 'meshes', name))),
    });
  }
  return makeZip(files);
}

test.describe('security headers (#507)', () => {
  test('_headers and the Caddyfile declare the same headers', () => {
    const cloudflare = cloudflareHeaders();
    const caddy = caddyHeaders();
    for (const [name, value] of Object.entries(REQUIRED_HEADERS)) {
      expect(cloudflare.get(name), name).toBe(value);
      expect(caddy.get(name), name).toBe(value);
    }

    const csp = cloudflare.get('Content-Security-Policy') ?? '';
    expect(directive(csp, 'default-src')).toEqual(["'self'"]);
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'script-src')).not.toContain("'unsafe-inline'");
    expect(directive(csp, 'script-src')).not.toContain("'unsafe-eval'");
    expect(directive(csp, 'connect-src')).toContain(SUPABASE_PLACEHOLDER);

    // Self-hosted copies send the same policy without the Cloudflare Web Analytics origins.
    const withoutAnalytics = csp
      .split('; ')
      .map((part) =>
        part
          .split(' ')
          .filter((source) => !CLOUDFLARE_ANALYTICS.some((origin) => source === origin))
          .join(' '),
      )
      .join('; ');
    expect(caddy.get('Content-Security-Policy')).toBe(withoutAnalytics);
  });

  test('every inline script of the build has its hash in script-src', () => {
    test.skip(!AGAINST_BUILD || !existsSync(DIST), BUILD_ONLY);
    const allowed = new Set(
      directive(cloudflareHeaders().get('Content-Security-Policy') ?? '', 'script-src'),
    );
    const missing = new Map<string, string>();
    for (const file of htmlFiles(DIST)) {
      const html = readFileSync(file, 'utf8');
      for (const match of html.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
        const attributes = match[1] ?? '';
        const body = match[2] ?? '';
        if (/\ssrc=/.test(attributes) || /type="application\/(ld\+)?json"/.test(attributes)) {
          continue;
        }
        const hash = `'sha256-${createHash('sha256').update(body).digest('base64')}'`;
        if (!allowed.has(hash)) missing.set(hash, path.relative(DIST, file));
      }
    }
    // Add each hash (and its line in the comment) to public/_headers and infra/Caddyfile.
    expect(Object.fromEntries(missing)).toEqual({});
  });

  test.describe('pages under the CSP', () => {
    test.skip(!AGAINST_BUILD, BUILD_ONLY);

    const PUBLIC_PAGES = [
      '/',
      '/ruta/ruta-1/',
      '/ruta/ruta-1/m00/t01/',
      '/ruta/ruta-1/m03/t03/',
      '/simuladores/movil',
      '/simuladores/brazo?robot=so101',
      '/brazos/',
      '/brazos/so101/',
      '/auth/login',
      '/docentes',
      '/no-existe/',
    ] as const;

    for (const pathname of PUBLIC_PAGES) {
      test(`${pathname} loads under the CSP without violations`, async ({ page }) => {
        const violations = await withCsp(page);
        await page.goto(pathname);
        await settle(page);
        expect(violations).toEqual([]);
      });
    }

    test('the arm simulator reads an imported zip under the CSP', async ({ page }) => {
      const violations = await withCsp(page);
      await page.goto('/simuladores/brazo?robot=planar2dof');
      await expect(page.locator('[data-testid="sims.arm.x"]')).not.toBeEmpty({
        timeout: ISLAND_TIMEOUT_MS,
      });
      await page.locator('[data-testid="arm-source-select"]').selectOption('import');
      await page.getByLabel(auth.robots.uploadField, { exact: true }).setInputFiles({
        name: 'so101.zip',
        mimeType: 'application/zip',
        buffer: Buffer.from(so101Zip()),
      });
      await page.getByRole('button', { name: auth.robots.uploadSubmit, exact: true }).click();
      await expect(page.getByTestId('import-notice')).toBeVisible({ timeout: ISLAND_TIMEOUT_MS });
      await page.waitForLoadState('networkidle');
      expect(violations).toEqual([]);
    });

    test('signing in, /cuenta and /aula talk to Supabase under the CSP', async ({ page }) => {
      const email = uniqueEmail('csp-teacher');
      await signUp('teacher', 'Docente CSP', email);
      const violations = await withCsp(page);

      await page.goto('/auth/login');
      await settle(page);
      await page.getByLabel(auth.fields.email, { exact: true }).fill(email);
      await page.getByLabel(auth.fields.password, { exact: true }).fill(E2E_PASSWORD);
      await page.getByRole('button', { name: auth.login.submit, exact: true }).click();
      await page.waitForURL('**/cuenta');
      await settle(page);

      await page.goto('/aula');
      await settle(page);
      await expect(page.getByTestId('groups-empty')).toBeVisible();
      expect(violations).toEqual([]);
    });
  });
});
