/**
 * docs:check — validates internal Markdown links in docs/** and CLAUDE.md.
 *
 * - Relative file links resolve first against the containing file, then
 *   against the repo root; they are reported only if both fail.
 * - Anchors (#section) are checked against GitHub-style heading slugs of the
 *   target file (or of the same file when the link is a bare anchor).
 * - http(s)://, mailto: links and links inside fenced code blocks are ignored.
 *
 * Output: one line per broken link `path/file.md:LINE  link -> reason`.
 * Exit code 1 if any link is broken, 0 otherwise.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/** @typedef {{ filePath: string; lineNumber: number; link: string; reason: string }} BrokenLink */

const repoRoot = resolve(import.meta.dirname, '..');
const docsDir = join(repoRoot, 'docs');

/** @param {string} filePath */
function toPosix(filePath) {
  return filePath.split('\\').join('/');
}

/**
 * @param {string} dir
 * @param {string[]} out
 */
function collectMarkdownFiles(dir, out) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      collectMarkdownFiles(fullPath, out);
    } else if (entry.endsWith('.md')) {
      out.push(fullPath);
    }
  }
}

/**
 * Returns the lines of a file with fenced code blocks blanked out (line count preserved).
 * @param {string} content
 */
function linesWithoutFences(content) {
  /** @type {string | null} */
  let fence = null;
  return content.split('\n').map((line) => {
    const match = /^\s*(`{3,}|~{3,})/.exec(line);
    if (match) {
      if (fence === null) {
        fence = match[1];
        return '';
      }
      if (match[1][0] === fence[0] && match[1].length >= fence.length) {
        fence = null;
        return '';
      }
    }
    return fence === null ? line : '';
  });
}

/** @param {string} heading */
function slugify(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-');
}

/** @type {Map<string, Set<string>>} */
const headingCache = new Map();

/** @param {string} filePath */
function headingSlugs(filePath) {
  const cached = headingCache.get(filePath);
  if (cached) return cached;
  /** @type {Set<string>} */
  const slugs = new Set();
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const line of linesWithoutFences(readFileSync(filePath, 'utf8'))) {
    const match = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const base = slugify(match[1].replace(/[`*_~]/g, ''));
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    slugs.add(seen === 0 ? base : `${base}-${seen}`);
  }
  headingCache.set(filePath, slugs);
  return slugs;
}

/** @param {string} target */
function isExternal(target) {
  return /^(https?:|mailto:|[a-z][a-z0-9+.-]*:\/\/)/i.test(target);
}

/** @param {string} line */
function extractLinks(line) {
  /** @type {string[]} */
  const links = [];
  const withoutInlineCode = line.replace(/`[^`]*`/g, '');
  const inline = /\]\(([^()\s]+(?:\([^()\s]*\)[^()\s]*)*)(?:\s+"[^"]*")?\)/g;
  for (const match of withoutInlineCode.matchAll(inline)) links.push(match[1]);
  const definition = /^\s{0,3}\[[^\]]+\]:\s+(\S+)/.exec(withoutInlineCode);
  if (definition) links.push(definition[1]);
  return links;
}

/**
 * Resolves a link's file part relative to the containing file, then to the repo root.
 * @param {string} filePath
 * @param {string} pathPart
 * @returns {string | undefined}
 */
function resolveTarget(filePath, pathPart) {
  if (pathPart === '') return filePath;
  const candidates = [resolve(dirname(filePath), pathPart), resolve(repoRoot, pathPart)];
  return candidates.find((candidate) => existsSync(candidate));
}

/**
 * @param {string} filePath
 * @param {BrokenLink[]} broken
 * @returns {number} number of internal links checked
 */
function checkFile(filePath, broken) {
  const displayPath = toPosix(relative(repoRoot, filePath));
  let checked = 0;
  linesWithoutFences(readFileSync(filePath, 'utf8')).forEach((line, index) => {
    for (const link of extractLinks(line)) {
      if (isExternal(link)) continue;
      checked += 1;
      const hashIndex = link.indexOf('#');
      const pathPart = decodeURIComponent(hashIndex === -1 ? link : link.slice(0, hashIndex));
      const anchor = hashIndex === -1 ? '' : decodeURIComponent(link.slice(hashIndex + 1));
      const target = resolveTarget(filePath, pathPart);
      if (target === undefined) {
        broken.push({
          filePath: displayPath,
          lineNumber: index + 1,
          link,
          reason: 'archivo no existe',
        });
      } else if (
        anchor !== '' &&
        target.endsWith('.md') &&
        !headingSlugs(target).has(anchor.toLowerCase())
      ) {
        const reason = `ancla #${anchor} no existe en ${toPosix(relative(repoRoot, target))}`;
        broken.push({ filePath: displayPath, lineNumber: index + 1, link, reason });
      }
    }
  });
  return checked;
}

function main() {
  /** @type {string[]} */
  const files = [join(repoRoot, 'CLAUDE.md')];
  collectMarkdownFiles(docsDir, files);
  files.sort();

  /** @type {BrokenLink[]} */
  const broken = [];
  let linkCount = 0;
  for (const filePath of files) linkCount += checkFile(filePath, broken);

  if (broken.length > 0) {
    for (const item of broken) {
      process.stdout.write(`${item.filePath}:${item.lineNumber}  ${item.link} -> ${item.reason}\n`);
    }
    process.stdout.write(
      `\ndocs:check: ${broken.length} enlace(s) roto(s) en ${files.length} archivo(s)\n`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `docs:check: ${files.length} archivo(s), ${linkCount} enlace(s) internos, 0 rotos\n`,
  );
}

main();
