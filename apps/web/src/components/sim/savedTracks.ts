import type { SavedTrack, TrackJson } from '@trayectoria/sims';

// F4-06 (#191, decisión 2): dónde van a parar las pistas guardadas. Sin sesión, al store local de
// `@trayectoria/sims` (el único archivo con `localStorage`); con sesión, al adaptador de
// `apps/web/src/lib/sim/trackPersistence.ts`, que se carga con `import()` para no meter
// `@supabase/supabase-js` en el JS inicial de una página que simula igual sin sesión.
//
// La decisión vive aquí y no en el hook, sin React de por medio, que es como `savedRobots.ts`
// separa la suya: así se prueba con un cliente y una sesión mockeados.
//
// No se migran pistas locales a la cuenta al iniciar sesión: está fuera de alcance (decisión 2);
// lo que sí ocurre es que la lista se relee.

/** La pista con geometría: el `TrackJson` sin la rama del nombre de preset. */
export type Track = Exclude<TrackJson, string>;

/** El id del estudiante con sesión, o `null` sin ella; espera a que la sesión esté leída. */
async function currentOwnerId(): Promise<string | null> {
  const { ensureSessionReady } = await import('@trayectoria/auth');
  const session = await ensureSessionReady();
  return session?.user.id ?? null;
}

/** Las pistas de la cuenta con sesión, o las del navegador sin ella. */
export async function loadSavedTracks(): Promise<readonly SavedTrack[]> {
  const ownerId = await currentOwnerId();
  if (ownerId === null) {
    const { listLocalTracks } = await import('@trayectoria/sims');
    return listLocalTracks();
  }
  const { listTracks } = await import('../../lib/sim/trackPersistence');
  return listTracks(ownerId);
}

/** Guarda `track` con el nombre `name` donde corresponda y devuelve la lista resultante. */
export async function storeSavedTrack(
  name: string,
  track: Track,
): Promise<readonly SavedTrack[]> {
  const ownerId = await currentOwnerId();
  if (ownerId === null) {
    const sims = await import('@trayectoria/sims');
    sims.saveLocalTrack(name, track);
    return sims.listLocalTracks();
  }
  const { listTracks, saveTrack } = await import('../../lib/sim/trackPersistence');
  await saveTrack(ownerId, name, track);
  return listTracks(ownerId);
}

/** Borra la pista `id` donde corresponda y devuelve la lista resultante. */
export async function removeSavedTrack(id: string): Promise<readonly SavedTrack[]> {
  const ownerId = await currentOwnerId();
  if (ownerId === null) {
    const sims = await import('@trayectoria/sims');
    sims.deleteLocalTrack(id);
    return sims.listLocalTracks();
  }
  const { deleteTrack, listTracks } = await import('../../lib/sim/trackPersistence');
  await deleteTrack(ownerId, id);
  return listTracks(ownerId);
}
