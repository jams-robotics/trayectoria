/**
 * Las pistas guardadas en la cuenta (F4-06, #191, decisión 2): las filas de `public.tracks`.
 * Vive en `apps/web` porque solo la app puede importar `@trayectoria/db` (regla de dependencias
 * de `eslint.config.js`).
 *
 * RLS es el único control de acceso: cada sentencia corre con la sesión del propio estudiante y
 * las políticas de `supabase/migrations/0006_tracks.sql` la acotan a `owner_id = auth.uid()`. El
 * `owner_id` va además en el `eq` de cada consulta, así que una fila de otro no se toca ni por
 * error. No se usa la `service_role` ni se lee ninguna pista ajena: no hay pistas compartidas
 * (docs/ARCHITECTURE.md §5.2).
 *
 * La columna `track` guarda exactamente lo que el editor exporta a un archivo (`serializeTrack`,
 * con su versión de esquema), así que guardar en la cuenta y exportar producen lo mismo, y lo
 * leído se valida con el mismo parser que un archivo antes de llegar a la página.
 */
import { getDbClient } from '@trayectoria/db';
import type { DbClient, Json } from '@trayectoria/db';
import { fromJson, serializeTrack } from '@trayectoria/sims';
import type { SavedTrack, TrackJson } from '@trayectoria/sims';

/**
 * La pista con geometría: el `TrackJson` sin la rama del nombre de preset. `apps/web` no puede
 * importar sim-core (docs/ARCHITECTURE.md §2), así que el tipo `Track` se nombra por lo que
 * `@trayectoria/sims` sí exporta, igual que en `TrackEditorBox.tsx`.
 */
type Track = Exclude<TrackJson, string>;

/** Las columnas que la página necesita de cada fila. */
const COLUMNS = 'id, name, track, updated_at';

/** Una fila ya leída, antes de validar su geometría. */
interface TrackRow {
  readonly id: string;
  readonly name: string;
  readonly track: Json;
  readonly updated_at: string;
}

/** Una fila como `SavedTrack`, o `null` si su `track` no es una pista que el editor abra. */
function parseRow(row: TrackRow): SavedTrack | null {
  const parsed = fromJson(JSON.stringify(row.track));
  if (!parsed.ok) return null;
  return { id: row.id, name: row.name, track: parsed.value.track, updatedAt: row.updated_at };
}

/** Si un valor ya leído de `JSON.parse` encaja en `Json`; lo es todo salvo `undefined`. */
function isJson(value: unknown): value is Json {
  return value !== undefined;
}

/**
 * El valor como JSON plano, que es lo que la columna `jsonb` guarda. El ida y vuelta por
 * `JSON.parse` es lo que convierte el texto de `serializeTrack` en datos, sin aserciones de tipo
 * (mismo patrón que `simConfigPersistence.ts`).
 */
function jsonOf(track: Track): Json {
  const parsed: unknown = JSON.parse(serializeTrack(track));
  return isJson(parsed) ? parsed : {};
}

/**
 * Las pistas guardadas del estudiante, de la más reciente a la más antigua. Un error de la
 * consulta se propaga: la página lo convierte en un aviso y sigue con la lista que tuviera.
 */
export async function listTracks(
  ownerId: string,
  db: DbClient = getDbClient(),
): Promise<readonly SavedTrack[]> {
  const { data, error } = await db
    .from('tracks')
    .select(COLUMNS)
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });
  if (error !== null) throw new Error(error.message);
  return (data ?? [])
    .map((row) => parseRow(row))
    .filter((saved): saved is SavedTrack => saved !== null);
}

/**
 * Guarda `track` con el nombre `name`. El índice único `(owner_id, name)` hace que el mismo
 * nombre actualice su fila en lugar de crear una segunda, así que es un `upsert` sobre esa
 * pareja de columnas y no un `insert` con un `select` previo.
 */
export async function saveTrack(
  ownerId: string,
  name: string,
  track: Track,
  db: DbClient = getDbClient(),
): Promise<void> {
  const { error } = await db
    .from('tracks')
    .upsert(
      { owner_id: ownerId, name, track: jsonOf(track), updated_at: new Date().toISOString() },
      { onConflict: 'owner_id,name' },
    );
  if (error !== null) throw new Error(error.message);
}

/** Borra la pista `id` del estudiante; una que no sea suya no la alcanza ni la política ni el `eq`. */
export async function deleteTrack(
  ownerId: string,
  id: string,
  db: DbClient = getDbClient(),
): Promise<void> {
  const { error } = await db.from('tracks').delete().eq('id', id).eq('owner_id', ownerId);
  if (error !== null) throw new Error(error.message);
}
