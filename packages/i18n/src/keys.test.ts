import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

import es from '../locales/es/common.json';

// Static check (F0-06): every key passed to t('…') in the UI code exists in common.json.
// It only sees literal keys, so keys are always written as literals (docs/ops/I18N.md).
const ROOT = path.resolve(import.meta.dirname, '../../..');
const SOURCE_EXTENSIONS = new Set(['.astro', '.ts', '.tsx']);
const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.astro']);
// t('key') or t("key"), including the t returned by useT(); tolerates line breaks after "(".
const T_CALL = /\bt\(\s*(['"])([^'"\n]+)\1/g;

interface KeyUsage {
  file: string;
  key: string;
}

function flattenKeys(value: unknown, prefix: string): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([name, child]) =>
    flattenKeys(child, prefix === '' ? name : `${prefix}.${name}`),
  );
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : listSourceFiles(full);
    const isTest = /\.test\.[jt]sx?$/.test(entry.name);
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !isTest ? [full] : [];
  });
}

function scanRoots(): string[] {
  const packageSources = readdirSync(path.join(ROOT, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(ROOT, 'packages', entry.name, 'src'));
  return [path.join(ROOT, 'apps/web/src'), ...packageSources].filter((dir) => {
    try {
      return readdirSync(dir).length > 0;
    } catch {
      return false;
    }
  });
}

function findKeyUsages(): KeyUsage[] {
  return scanRoots()
    .flatMap(listSourceFiles)
    .flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const relative = path.relative(ROOT, file).split(path.sep).join('/');
      return [...source.matchAll(T_CALL)].map((match) => ({ file: relative, key: match[2] ?? '' }));
    });
}

describe('F0-06 i18n keys', () => {
  const definedKeys = new Set(flattenKeys(es, ''));
  const usages = findKeyUsages();

  test('the scan finds t() calls in apps/web', () => {
    expect(usages.some(({ file }) => file.startsWith('apps/web/src/'))).toBe(true);
  });

  test('every key used in the code exists in locales/es/common.json', () => {
    const missing = usages.filter(({ key }) => !definedKeys.has(key));
    const report = missing.map(({ file, key }) => `${file}: missing key "${key}"`).join('\n');
    expect(missing, `Keys used but not defined in common.json:\n${report}`).toEqual([]);
  });
});
