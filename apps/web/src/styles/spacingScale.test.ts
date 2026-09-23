import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * Regression guard for #225: global.css clears Tailwind's default spacing scale and only exposes
 * the D-01 tokens `--spacing-0..12`, so a spacing or size utility outside that range (`w-72`,
 * `lg:w-80`, `-mt-16`) generates no CSS and fails silently. This test walks the sources Tailwind
 * scans and fails with the file and class of every such utility. Arbitrary values (`w-[...]`)
 * and named utilities (`w-full`, `w-panel`) are out of its scope.
 */

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const SOURCE_EXTENSIONS = ['.tsx', '.astro'];
const MAX_TOKEN_STEP = 12;

const SCALE_PREFIXES = [
  'p',
  'px',
  'py',
  'pt',
  'pr',
  'pb',
  'pl',
  'ps',
  'pe',
  'm',
  'mx',
  'my',
  'mt',
  'mr',
  'mb',
  'ml',
  'ms',
  'me',
  'gap',
  'gap-x',
  'gap-y',
  'space-x',
  'space-y',
  'inset',
  'inset-x',
  'inset-y',
  'top',
  'right',
  'bottom',
  'left',
  'start',
  'end',
  'scroll-m',
  'scroll-mx',
  'scroll-my',
  'scroll-mt',
  'scroll-mr',
  'scroll-mb',
  'scroll-ml',
  'scroll-p',
  'scroll-px',
  'scroll-py',
  'scroll-pt',
  'scroll-pr',
  'scroll-pb',
  'scroll-pl',
  'w',
  'h',
  'size',
  'min-w',
  'min-h',
  'max-w',
  'max-h',
  'basis',
];

const SCALE_UTILITY = new RegExp(`^-?(?:${SCALE_PREFIXES.join('|')})-(\\d+(?:\\.\\d+)?)$`);

// Comments may quote a broken class to explain a fix; only live code counts. A `//` right after
// `:` is a URL, not a comment.
const COMMENTS = /\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|(?<!:)\/\/.*$/gm;

/** Returns every class in `source` that uses a numeric spacing step outside 0..12. */
function findOffScaleClasses(source: string): string[] {
  return source
    .replace(COMMENTS, ' ')
    .split(/[\s"'`{}(),;]+/)
    .filter((token) => {
      const utility = token.slice(token.lastIndexOf(':') + 1).replace(/^!|!$/g, '');
      const match = SCALE_UTILITY.exec(utility);
      if (!match) return false;
      const step = Number(match[1]);
      return !Number.isInteger(step) || step > MAX_TOKEN_STEP;
    });
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) ? [path] : [];
  });
}

function scannedRoots(): string[] {
  const packagesDir = join(REPO_ROOT, 'packages');
  const packageSrcDirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesDir, entry.name, 'src'))
    .filter((dir) => existsSync(dir));
  return [join(REPO_ROOT, 'apps', 'web', 'src'), ...packageSrcDirs];
}

describe('findOffScaleClasses', () => {
  test('flags steps above 12, with or without variants and sign', () => {
    const source = `<div className="w-80 md:w-72 lg:w-80 -mt-16 hover:p-14 w-20 w-0.5" />`;
    expect(findOffScaleClasses(source)).toEqual([
      'w-80',
      'md:w-72',
      'lg:w-80',
      '-mt-16',
      'hover:p-14',
      'w-20',
      'w-0.5',
    ]);
  });

  test('ignores classes quoted in comments', () => {
    const source = `// \`w-24\` never generated
/* lg:w-80 */
<!-- w-72 -->
<a href="https://x.dev/w-80" className="w-12" />`;
    expect(findOffScaleClasses(source)).toEqual([]);
  });

  test('accepts the token scale, named and arbitrary utilities', () => {
    const source = `<div className={cn('w-0 w-12 lg:w-panel -mt-4 gap-3 w-full w-1/2 w-[352px] min-w-0')} />`;
    expect(findOffScaleClasses(source)).toEqual([]);
  });
});

describe('spacing scale in sources', () => {
  test('no spacing or size utility uses a step outside the D-01 tokens', () => {
    const offenders = scannedRoots()
      .flatMap(listSourceFiles)
      .flatMap((file) =>
        findOffScaleClasses(readFileSync(file, 'utf8')).map(
          (cls) => `${relative(REPO_ROOT, file).split(sep).join('/')}: ${cls}`,
        ),
      );
    expect(offenders).toEqual([]);
  });
});
