import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { findRobotCalc } from './robotCalcs';

// F6-01 (#243, decision 3): every `<RobotFormula calc="…" />` of a topic names a calc of the
// real registry (`@trayectoria/content` plus the demo of `robotCalcs.ts`), keyed
// `<topicId>/<calcId>` with the topic's own id. The build fails too (`RobotFormula.astro`); this
// test names every bad key of every topic at once, under `pnpm test`.
const CONTENT_DIR = resolve(import.meta.dirname, '../../../../content/es');
const ROBOT_FORMULA_CALC = /<RobotFormula\s[^>]*?calc=["']([^"']+)["']/g;
const DEMO_PREFIX = 'demo/';

interface RobotFormulaUse {
  readonly topicId: string;
  readonly calc: string;
}

/** Topic ids `ruta-N/mNN-tNN` that have an `index.mdx`. */
function topicIds(): string[] {
  return readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((route) => route.isDirectory())
    .flatMap((route) =>
      readdirSync(join(CONTENT_DIR, route.name), { withFileTypes: true })
        .filter((topic) => topic.isDirectory() && /^m\d{2}-t\d{2}$/.test(topic.name))
        .map((topic) => `${route.name}/${topic.name}`),
    )
    .filter((topicId) => {
      try {
        return readFileSync(join(CONTENT_DIR, topicId, 'index.mdx'), 'utf8').length > 0;
      } catch {
        return false;
      }
    });
}

/** The `calc` keys a topic MDX passes to `RobotFormula`. */
function robotFormulaCalcs(mdx: string): string[] {
  return [...mdx.matchAll(ROBOT_FORMULA_CALC)].map((match) => match[1] ?? '');
}

/** A use is valid when it is a demo key or a key of its own topic, and the registry has it. */
function problem({ topicId, calc }: RobotFormulaUse): string | undefined {
  const ownTopic = calc.startsWith(DEMO_PREFIX) || calc.startsWith(`${topicId}/`);
  if (ownTopic && findRobotCalc(calc) !== undefined) return undefined;
  return `${topicId}: <RobotFormula> uses the calc "${calc}", which is not in ${topicId}/alrobot.ts`;
}

describe('RobotFormula keys of the topics', () => {
  it('reads the calc of each RobotFormula of an MDX', () => {
    const mdx =
      '<RobotFormula calc="ruta-1/m00-t01/omega-rueda" />\n<RobotFormula\n  calc=\'demo/omega-rueda\'\n/>';

    expect(robotFormulaCalcs(mdx)).toEqual(['ruta-1/m00-t01/omega-rueda', 'demo/omega-rueda']);
  });

  it('names the topic and the key of a calc missing from the registry or from another topic', () => {
    expect(problem({ topicId: 'ruta-1/m00-t01', calc: 'demo/omega-rueda' })).toBeUndefined();
    expect(problem({ topicId: 'ruta-1/m00-t01', calc: 'ruta-1/m00-t01/nope' })).toBe(
      'ruta-1/m00-t01: <RobotFormula> uses the calc "ruta-1/m00-t01/nope", which is not in ruta-1/m00-t01/alrobot.ts',
    );
  });

  it('finds every calc of every topic in the registry', () => {
    expect(topicIds()).toContain('ruta-1/m00-t01');
    const problems = topicIds()
      .flatMap((topicId) =>
        robotFormulaCalcs(readFileSync(join(CONTENT_DIR, topicId, 'index.mdx'), 'utf8')).map(
          (calc) => ({ topicId, calc }),
        ),
      )
      .map(problem)
      .filter((text) => text !== undefined);

    expect(problems, problems.join('\n')).toEqual([]);
  });
});
