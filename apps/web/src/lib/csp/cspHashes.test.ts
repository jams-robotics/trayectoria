import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// #665: scripts/csp-hashes.mjs writes the hashes of the inline scripts of the build into the
// script-src of a headers file. Run as the CLI that deploy.yml and the Dockerfile call.
const SCRIPT = path.resolve(import.meta.dirname, '../../../../../scripts/csp-hashes.mjs');

const THEME = 'document.documentElement.dataset.theme = "dark";';
const NAV = 'console.log("nav");';
const OUTLINE = 'console.log("outline");';
/** SHA-256 (base64) of THEME, NAV and OUTLINE, sorted as the script writes them. */
const GOLDEN = [
  "'sha256-RH/36EFn2TnZtn39Gf6aq1rnKqEXnEQbfAXoYkwhRP0='",
  "'sha256-htw7+6je3QhvxLR8rpWN16FHhqxTPLBNzf3fa5uER7U='",
  "'sha256-iFMW1Lowd54EOlwThswIHlXdecDzA+MUND+CMEHT4nM='",
].sort();

/** A comment that names the marker keeps it: only the policy gets the hashes. */
const COMMENT = '# __SCRIPT_HASHES__ is replaced when deploying.';
const POLICY =
  "script-src 'self' __SCRIPT_HASHES__ https://static.cloudflareinsights.com; img-src 'self'";

let root = '';
let dist = '';
let headers = '';

function run(...args: string[]): { status: number; stderr: string } {
  try {
    execFileSync(process.execPath, [SCRIPT, ...args], { stdio: 'pipe' });
    return { status: 0, stderr: '' };
  } catch (error) {
    const failed = error as { status: number; stderr: Buffer };
    return { status: failed.status, stderr: failed.stderr.toString() };
  }
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'csp-hashes-'));
  dist = path.join(root, 'dist');
  mkdirSync(path.join(dist, 'ruta'), { recursive: true });
  writeFileSync(
    path.join(dist, 'index.html'),
    `<html><head><script>${THEME}</script><script type="module" src="/_astro/app.js"></script>` +
      `<script type="application/ld+json">{"@type":"Course"}</script></head>` +
      `<body><script type="module">${NAV}</script></body></html>`,
  );
  writeFileSync(
    path.join(dist, 'ruta', 'index.html'),
    `<html><head><script>${THEME}</script></head><body><SCRIPT>${OUTLINE}</SCRIPT ></body></html>`,
  );
  headers = path.join(root, '_headers');
  writeFileSync(headers, `${COMMENT}\n/*\n  Content-Security-Policy: ${POLICY}\n`);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('scripts/csp-hashes.mjs (#665)', () => {
  it('writes each inline script hash once, sorted, in place of the marker of the policy', () => {
    expect(run(headers, dist).status).toBe(0);
    expect(readFileSync(headers, 'utf8')).toBe(
      `${COMMENT}\n/*\n  Content-Security-Policy: ${POLICY.replace('__SCRIPT_HASHES__', GOLDEN.join(' '))}\n`,
    );
  });

  it('fails when the policy has no marker', () => {
    writeFileSync(headers, `${COMMENT}\n  Content-Security-Policy: script-src 'self'\n`);
    const result = run(headers, dist);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no __SCRIPT_HASHES__');
  });

  it('fails when there is no build', () => {
    const result = run(headers, path.join(root, 'missing'));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no build');
    expect(readFileSync(headers, 'utf8')).toContain('__SCRIPT_HASHES__');
  });

  it('fails without a file argument', () => {
    expect(run().status).toBe(1);
  });
});
