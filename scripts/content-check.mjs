/**
 * content:check — validates the mandatory anatomy of every topic (docs/CONTENT-STANDARDS.md §2).
 *
 * Walks `content/es/<ruta>/<mNN-tNN>/index.mdx` and requires the 7 sections as top-level JSX
 * tags, in the standard's order. With a `status` other than `draft` it also requires 2 to 4
 * `Experimento` inside `Explora` and 3 to 5 exercises in `Verifica` (#97, decision 3). That every
 * `Verifica` key actually resolves is checked by `apps/web/src/lib/verifica.test.ts` against the
 * `EXERCISES` registry, and the build also fails on an unknown key (`Verifica.astro`) (F6-00).
 *
 * Output: one line per violation, `content/es/<id>/index.mdx: <reason>`.
 * Exit code 1 if any topic fails, 0 if all pass.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/** @typedef {{ file: string; reason: string }} Finding */

const repoRoot = resolve(import.meta.dirname, '..');
const contentDir = join(repoRoot, 'content/es');

/** Secciones obligatorias, en el orden de docs/CONTENT-STANDARDS.md §2. */
const SECTIONS = ['Gancho', 'Concepto', 'Formulas', 'Explora', 'AlRobot', 'Verifica', 'Profundiza'];

/** Límites que el estándar fija para un tema ya escrito (§2, puntos 4 y 6). */
const LIMITS = { experiments: { min: 2, max: 4 }, exercises: { min: 3, max: 5 } };

/** @param {string} filePath */
function toPosix(filePath) {
  return filePath.split('\\').join('/');
}

/**
 * Devuelve la ruta de cada `index.mdx` de tema bajo `content/es`.
 * @returns {string[]}
 */
function collectTopics() {
  /** @type {string[]} */
  const files = [];
  for (const route of readdirSync(contentDir)) {
    const routeDir = join(contentDir, route);
    if (!statSync(routeDir).isDirectory()) continue;
    for (const topic of readdirSync(routeDir)) {
      if (!/^m\d{2}-t\d{2}$/.test(topic)) continue;
      const file = join(routeDir, topic, 'index.mdx');
      try {
        if (statSync(file).isFile()) files.push(file);
      } catch {
        // Una carpeta de tema sin index.mdx no es un tema todavía; la colección la ignora.
      }
    }
  }
  return files.sort();
}

/**
 * Cuerpo del MDX sin el frontmatter, y el `status` que este declara.
 * @param {string} content
 * @returns {{ body: string; status: string }}
 */
function splitFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(content);
  if (match === null) return { body: content, status: 'draft' };
  const status = /^status:\s*(\S+)\s*$/m.exec(match[1]);
  return { body: match[2], status: status === null ? 'draft' : status[1] };
}

/**
 * Nombres de las etiquetas JSX de nivel superior del cuerpo, en orden de aparición. Una etiqueta
 * de nivel superior empieza en la primera columna; las anidadas van indentadas.
 * @param {string} body
 * @returns {string[]}
 */
function topLevelTags(body) {
  /** @type {string[]} */
  const tags = [];
  for (const line of body.split('\n')) {
    const match = /^<([A-Z][A-Za-z0-9]*)/.exec(line);
    if (match !== null) tags.push(match[1]);
  }
  return tags;
}

/**
 * Cuenta las apariciones de una etiqueta JSX en el cuerpo, abierta o autocerrada.
 * @param {string} body
 * @param {string} tag
 */
function countTag(body, tag) {
  const matches = body.match(new RegExp(`<${tag}(?=[\\s/>])`, 'g'));
  return matches === null ? 0 : matches.length;
}

/**
 * Claves que `Verifica` recibe en su prop `ejercicios={[…]}`, sin comillas.
 * @param {string} body
 * @returns {string[]}
 */
function exerciseKeys(body) {
  const match = /ejercicios=\{\[([^\]]*)\]\}/.exec(body);
  if (match === null) return [];
  return match[1]
    .split(',')
    .map((item) => item.trim().replace(/^['"`]|['"`]$/g, ''))
    .filter((key) => key !== '');
}

/**
 * @param {string} file
 * @param {Finding[]} findings
 */
function checkTopic(file, findings) {
  const display = toPosix(relative(repoRoot, file));
  /** @param {string} reason */
  const report = (reason) => findings.push({ file: display, reason });

  const { body, status } = splitFrontmatter(readFileSync(file, 'utf8'));
  const tags = topLevelTags(body).filter((tag) => SECTIONS.includes(tag));

  const missing = SECTIONS.filter((section) => !tags.includes(section));
  for (const section of missing) report(`falta la sección <${section}>`);
  if (missing.length === 0) {
    const expected = SECTIONS.join(', ');
    if (tags.join(',') !== SECTIONS.join(',')) {
      report(`las secciones están en el orden ${tags.join(', ')}; el orden es ${expected}`);
    }
  }

  const keys = exerciseKeys(body);

  if (status === 'draft') return;

  const experiments = countTag(body, 'Experimento');
  const { experiments: exp, exercises: ex } = LIMITS;
  if (experiments < exp.min || experiments > exp.max) {
    report(
      `<Explora> tiene ${experiments} <Experimento>; el estándar pide de ${exp.min} a ${exp.max}`,
    );
  }
  const exercises = keys.length;
  if (exercises < ex.min || exercises > ex.max) {
    report(`<Verifica> tiene ${exercises} ejercicios; el estándar pide de ${ex.min} a ${ex.max}`);
  }
}

function main() {
  const files = collectTopics();
  /** @type {Finding[]} */
  const findings = [];
  for (const file of files) checkTopic(file, findings);

  if (findings.length > 0) {
    for (const { file, reason } of findings) {
      process.stdout.write(`${file}: ${reason}\n`);
    }
    process.stdout.write(
      `\ncontent:check: ${findings.length} incumplimiento(s) en ${files.length} tema(s)\n`,
    );
    process.exit(1);
  }
  process.stdout.write(`content:check: ${files.length} tema(s), 0 incumplimientos\n`);
}

main();
