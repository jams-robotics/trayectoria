// Writes the hashes of the inline scripts of the build into the Content-Security-Policy of a
// headers file (#665).
// Usage: node scripts/csp-hashes.mjs <file> [dist]   (dist defaults to apps/web/dist)
// Replaces __SCRIPT_HASHES__ in <file> with "'sha256-…' 'sha256-…'": the SHA-256 of the body of
// every <script> of dist/**/*.html that has no src and is not JSON data, each one once, sorted.
// Called by .github/workflows/deploy.yml on apps/web/dist/_headers and by infra/web.Dockerfile on
// the Caddyfile, before infra/csp-origins.sh; apps/web/e2e/csp.spec.ts applies it to a copy.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKER = '__SCRIPT_HASHES__';
const DEFAULT_DIST = fileURLToPath(new URL('../apps/web/dist', import.meta.url));

function fail(message) {
  console.error(`csp-hashes.mjs: ${message}`);
  process.exit(1);
}

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(file);
    return entry.name.endsWith('.html') ? [file] : [];
  });
}

const [file, dist = DEFAULT_DIST] = process.argv.slice(2);
if (!file) fail('usage: csp-hashes.mjs <file> [dist]');
if (!existsSync(dist) || !statSync(dist).isDirectory()) fail(`no build in ${dist}`);

// Comment lines (#) may name the marker; only the policy itself gets the hashes.
const lines = readFileSync(file, 'utf8').split('\n');
const isPolicy = (line) => !line.trimStart().startsWith('#') && line.includes(MARKER);
if (!lines.some(isPolicy)) fail(`no ${MARKER} in ${file}`);

const SCRIPT = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g;
const hashes = new Set();
for (const html of htmlFiles(dist)) {
  for (const [, attributes = '', body = ''] of readFileSync(html, 'utf8').matchAll(SCRIPT)) {
    if (/\ssrc=/.test(attributes) || /type="application\/(ld\+)?json"/.test(attributes)) continue;
    const hash = createHash('sha256').update(body).digest('base64');
    hashes.add(`'sha256-${hash}'`);
  }
}
if (hashes.size === 0) fail(`no inline script in ${dist}`);

const sources = [...hashes].sort().join(' ');
writeFileSync(
  file,
  lines.map((line) => (isPolicy(line) ? line.replaceAll(MARKER, sources) : line)).join('\n'),
);
