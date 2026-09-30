/**
 * Equivalence table of the two routes (#574; docs/CURRICULUM.md, «Tabla de equivalencias», and
 * docs/ARCHITECTURE.md §5.4): the 28 topic ids of the single route before the restructuring and
 * the id each one has now. `supabase/migrations/0012_two_routes.sql` copies the same pairs, and
 * `routeMap.test.ts` reads that file and checks that they match.
 */

/** Version of the browser copy whose topic ids are already the ones of the two routes. */
export const ROUTES_VERSION = 2;

/** Old topic id → new topic id, the 28 of them, also the ones that do not change. */
export const TOPIC_ID_MAP: Readonly<Record<string, string>> = {
  'ruta-1/m00-t01': 'ruta-1/m00-t01',
  'ruta-1/m00-t02': 'ruta-1/m00-t02',
  'ruta-1/m00-t03': 'ruta-1/m00-t03',
  'ruta-1/m01-t01': 'ruta-1/m01-t01',
  'ruta-1/m01-t02': 'ruta-1/m01-t02',
  'ruta-1/m01-t03': 'reserva/caida-libre',
  'ruta-1/m01-t04': 'reserva/tiro-parabolico',
  'ruta-1/m02-t01': 'ruta-1/m02-t01',
  'ruta-1/m02-t02': 'ruta-1/m02-t02',
  'ruta-1/m02-t03': 'ruta-1/m02-t04',
  'ruta-1/m03-t01': 'ruta-1/m03-t01',
  'ruta-1/m03-t02': 'ruta-1/m03-t02',
  'ruta-1/m03-t03': 'ruta-1/m03-t03',
  'ruta-1/m04-t01': 'ruta-1/m01-t03',
  'ruta-1/m04-t02': 'ruta-1/m01-t04',
  'ruta-1/m04-t03': 'ruta-1/m02-t03',
  'ruta-1/m04-t04': 'ruta-1/m02-t04',
  'ruta-1/m04-t05': 'ruta-2/m00-t01',
  'ruta-1/m05-t01': 'ruta-2/m00-t02',
  'ruta-1/m05-t02': 'ruta-2/m01-t01',
  'ruta-1/m05-t03': 'ruta-2/m01-t02',
  'ruta-1/m05-t04': 'ruta-2/m01-t03',
  'ruta-1/m05-t05': 'ruta-2/m01-t04',
  'ruta-1/m06-t01': 'ruta-2/m02-t01',
  'ruta-1/m06-t02': 'ruta-2/m02-t02',
  'ruta-1/m06-t03': 'ruta-2/m02-t03',
  'ruta-1/m06-t04': 'ruta-2/m02-t04',
  'ruta-1/m06-t05': 'ruta-2/m02-t05',
};

/**
 * Exercises of the two topics that fold into `ruta-1/m02-t04` (Torque and Transmission): old
 * exercise id → new one («Ejercicios del tema fusionado»). An exercise of either topic missing
 * here was removed from the merged topic.
 */
export const MERGED_EXERCISE_MAP: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'ruta-1/m02-t03': { e1: 'e1', e3: 'e3', e2: 'e4' },
  'ruta-1/m04-t04': { e3: 'e2' },
};
