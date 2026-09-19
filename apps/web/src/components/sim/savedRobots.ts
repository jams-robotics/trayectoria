/**
 * Los robots móviles guardados del estudiante (F4-02b, #128, decisión 2): las filas
 * `kind = 'mobile-diff'` de `public.robots`. Vive en `apps/web` porque solo la app puede importar
 * `@trayectoria/db` y `@trayectoria/auth` (regla de dependencias de `eslint.config.js`), y lee con
 * el cliente y las políticas que ya existen: RLS las acota a `owner_id = auth.uid()` y no hay
 * migración ni política nueva (mismo acceso que `apps/web/src/stores/robotPersistence.ts`,
 * revisado en F2-11).
 *
 * `RobotSource` lo carga con `import()`: así `@supabase/supabase-js` no entra en el JS inicial de
 * `/simuladores/movil` y la página cumple el presupuesto de docs/ARCHITECTURE.md §8. Un estudiante
 * sin sesión nunca llega a descargarlo.
 */
import { $session, $sessionReady } from '@trayectoria/auth';
import { getDbClient } from '@trayectoria/db';
import type { DbClient } from '@trayectoria/db';
import { parseStoredRobot } from '@trayectoria/widgets';
import type { RobotSpec } from '@trayectoria/widgets';

/** El único `kind` que esta página simula. */
export const MOBILE_KIND = 'mobile-diff';

/** Un robot guardado tal y como lo muestra el selector. */
export interface SavedRobot {
  readonly id: string;
  readonly name: string;
  readonly spec: RobotSpec;
}

/**
 * Los robots móviles del dueño `ownerId`, ordenados por nombre. Una fila cuyo `spec` no valida se
 * deja fuera en lugar de romper el selector; un error de la consulta devuelve la lista vacía,
 * que es lo que la página muestra como «no hay robots guardados».
 */
export async function listSavedRobots(
  ownerId: string,
  db: DbClient = getDbClient(),
): Promise<readonly SavedRobot[]> {
  const { data, error } = await db
    .from('robots')
    .select('id, name, spec')
    .eq('owner_id', ownerId)
    .eq('kind', MOBILE_KIND)
    .order('name');
  if (error !== null || data === null) return [];
  const robots: SavedRobot[] = [];
  for (const row of data) {
    const spec = parseStoredRobot(row.spec);
    if (spec !== null) robots.push({ id: row.id, name: row.name, spec });
  }
  return robots;
}

/**
 * Los robots guardados del estudiante que tenga sesión ahora mismo, o la lista vacía si no la
 * hay. Espera a `$sessionReady` porque la sesión se lee de forma asíncrona al montar
 * (`packages/auth`) y antes de eso `$session` vale `null` para todo el mundo.
 */
export async function loadForCurrentSession(): Promise<readonly SavedRobot[]> {
  if (!$sessionReady.get()) {
    await new Promise<void>((resolve) => {
      const stop = $sessionReady.subscribe((ready) => {
        if (!ready) return;
        stop();
        resolve();
      });
    });
  }
  const ownerId = $session.get()?.user.id ?? null;
  return ownerId === null ? [] : listSavedRobots(ownerId);
}
