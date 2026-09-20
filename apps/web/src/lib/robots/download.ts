/**
 * Lectura del zip de un brazo guardado (F5-04, #137, decisión 5): el complemento de `storage.ts`,
 * que es quien lo escribe. Todo corre con el cliente de la sesión y la clave anon, así que las
 * políticas de la migración 0003 son el único control de acceso: un objeto de otro `uid` lo
 * rechaza RLS y aquí se convierte en un error genérico, sin filtrar el mensaje de Supabase
 * (docs/ARCHITECTURE.md §5.2 y §6). Sin `service_role` y sin migración.
 */
import type { DbClient } from '@trayectoria/db';

import { URDF_BUCKET } from './storage';

/** Clave i18n del único error que la UI muestra cuando una descarga no sale. */
export const DOWNLOAD_FAILED_KEY = 'sims.import.downloadFailed';

/** El `kind` de las filas que este selector muestra. */
const ARM_KIND = 'arm-serial';

/** Un brazo guardado, tal y como lo lista el selector del simulador. */
export interface ImportedArm {
  readonly id: string;
  readonly name: string;
  /** Valor de `robots.urdf_path`; se usa tal cual, nunca se construye desde la entrada. */
  readonly urdfPath: string;
}

/**
 * La clave del objeto dentro del bucket, a partir del valor que guarda `robots.urdf_path`
 * (`urdf/{uid}/{id}.zip`). La ruta viaja tal y como está en la fila: esta función solo quita el
 * prefijo del bucket que el cliente de Storage ya aporta.
 */
export function objectKeyOf(urdfPath: string): string {
  const prefix = `${URDF_BUCKET}/`;
  return urdfPath.startsWith(prefix) ? urdfPath.slice(prefix.length) : urdfPath;
}

/** Una ruta utilizable: la de una fila propia, sin segmentos que se salgan de su carpeta. */
function isUsableKey(key: string): boolean {
  if (key === '' || key.startsWith('/') || key.includes('\\')) return false;
  return !key.split('/').includes('..');
}

/**
 * Descarga el zip de un brazo guardado del bucket `urdf`. Cualquier fallo —RLS, objeto que ya no
 * está, respuesta vacía— sale como la misma clave genérica: el estudiante no necesita el detalle y
 * el detalle no debe salir del servidor.
 *
 * @throws Error con `sims.import.downloadFailed` si el objeto no se puede leer.
 */
export async function downloadRobotZip(
  db: DbClient,
  urdfPath: string | null,
): Promise<Uint8Array> {
  if (urdfPath === null) throw new Error(DOWNLOAD_FAILED_KEY);
  const key = objectKeyOf(urdfPath);
  if (!isUsableKey(key)) throw new Error(DOWNLOAD_FAILED_KEY);

  const { data, error } = await db.storage.from(URDF_BUCKET).download(key);
  if (error !== null || data === null) throw new Error(DOWNLOAD_FAILED_KEY);
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * Los brazos que este estudiante ha subido: las filas `kind = 'arm-serial'` con archivo. Un error
 * de la consulta devuelve la lista vacía, que es lo que el selector muestra como «todavía no
 * tienes brazos guardados», igual que `savedRobots.ts` hace con los móviles.
 */
export async function listImportedArms(
  db: DbClient,
  ownerId: string,
): Promise<readonly ImportedArm[]> {
  const { data, error } = await db
    .from('robots')
    .select('id, name, urdf_path')
    .eq('owner_id', ownerId)
    .eq('kind', ARM_KIND)
    .order('name');
  if (error !== null || data === null) return [];
  return data
    .filter((row): row is typeof row & { urdf_path: string } => row.urdf_path !== null)
    .map((row) => ({ id: row.id, name: row.name, urdfPath: row.urdf_path }));
}
