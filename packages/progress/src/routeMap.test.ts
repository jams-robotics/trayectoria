import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { MERGED_EXERCISE_MAP, ROUTES_VERSION, TOPIC_ID_MAP } from './routeMap';

// docs/ARCHITECTURE.md §5.4: the migration copies the same pairs as routeMap.ts, and this test
// reads the SQL file and checks that they match. docs/CURRICULUM.md, «Tabla de equivalencias».
const MIGRATION = join(import.meta.dirname, '../../../supabase/migrations/0012_two_routes.sql');
const SQL = readFileSync(MIGRATION, 'utf8');

/** The `values (…), (…);` list of the `insert into pg_temp.<table>` statement, one tuple each. */
function sqlTuples(table: string): string[][] {
  const statement = new RegExp(`insert into pg_temp\\.${table} \\([^)]*\\) values([\\s\\S]*?);`);
  const values = statement.exec(SQL)?.[1];
  if (values === undefined) throw new Error(`no insert into pg_temp.${table} in the migration`);
  return [...values.matchAll(/\(([^)]*)\)/g)].map((tuple) =>
    [...(tuple[1] ?? '').matchAll(/'([^']*)'/g)].map((literal) => literal[1] ?? ''),
  );
}

describe('equivalence table of the two routes', () => {
  test('28 old ids: 25 published in two routes, 2 in the reserve, Torque and Transmission merged', () => {
    const newIds = Object.values(TOPIC_ID_MAP);
    expect(Object.keys(TOPIC_ID_MAP)).toHaveLength(28);
    expect(new Set(newIds).size).toBe(27);
    expect(newIds.filter((id) => id.startsWith('ruta-1/'))).toHaveLength(15);
    expect(new Set(newIds.filter((id) => id.startsWith('ruta-1/'))).size).toBe(14);
    expect(newIds.filter((id) => id.startsWith('ruta-2/'))).toHaveLength(11);
    expect(newIds.filter((id) => id.startsWith('reserva/')).sort()).toEqual([
      'reserva/caida-libre',
      'reserva/tiro-parabolico',
    ]);
    expect(TOPIC_ID_MAP['ruta-1/m02-t03']).toBe('ruta-1/m02-t04');
    expect(TOPIC_ID_MAP['ruta-1/m04-t04']).toBe('ruta-1/m02-t04');
  });

  test('the exercises of the merged topic follow «Ejercicios del tema fusionado»', () => {
    expect(MERGED_EXERCISE_MAP).toEqual({
      'ruta-1/m02-t03': { e1: 'e1', e3: 'e3', e2: 'e4' },
      'ruta-1/m04-t04': { e3: 'e2' },
    });
  });

  test('the browser copy of the two routes is version 2', () => {
    expect(ROUTES_VERSION).toBe(2);
  });
});

describe('0012_two_routes.sql matches routeMap.ts', () => {
  test('topic_map holds the 28 pairs of TOPIC_ID_MAP, and only those', () => {
    const pairs = sqlTuples('topic_map');
    expect(pairs).toHaveLength(28);
    expect(Object.fromEntries(pairs.map(([oldId, newId]) => [oldId, newId]))).toEqual(TOPIC_ID_MAP);
  });

  test('merged_exercise_map holds the pairs of MERGED_EXERCISE_MAP, and only those', () => {
    const triples = sqlTuples('merged_exercise_map');
    const fromSql: Record<string, Record<string, string>> = {};
    for (const [topicId = '', oldExercise = '', newExercise = ''] of triples) {
      fromSql[topicId] = { ...fromSql[topicId], [oldExercise]: newExercise };
    }
    expect(triples).toHaveLength(4);
    expect(fromSql).toEqual(MERGED_EXERCISE_MAP);
  });
});
