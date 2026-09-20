import type { SimConfig } from '@trayectoria/robot-spec';

import { parseSimConfig } from '../codec';

// F4-05 (#131, decisión 4): las configuraciones guardadas del navegador. Es el único archivo del
// entregable que toca `localStorage` (docs/STANDARDS.md §10), así que el panel y el adaptador de
// Supabase no lo mencionan siquiera.
//
// Lo guardado es una lista de `SimConfig` validada al leer con el esquema de robot-spec: una
// entrada que no lo cumple —de una versión anterior, de otra pestaña o escrita a mano— se
// descarta en lugar de romper la página. Nada de lo que hay aquí lanza: sin sesión y sin
// almacenamiento el simulador sigue funcionando, solo que sin lista.

/** Clave de `localStorage` donde vive la lista (spec del ticket). */
export const SIM_CONFIGS_KEY = 'trayectoria.simConfigs';

/** El almacenamiento del navegador, o `null` donde no lo haya (SSR, pruebas, modo restringido). */
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Las configuraciones guardadas, en el orden en que se guardaron; las inválidas se descartan. */
export function listSimConfigs(): readonly SimConfig[] {
  const store = storage();
  if (store === null) return [];
  let data: unknown;
  try {
    const raw = store.getItem(SIM_CONFIGS_KEY);
    if (raw === null) return [];
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => parseSimConfig(entry))
    .filter((config) => config !== null);
}

/** Escribe la lista completa; un almacenamiento lleno o bloqueado no rompe a quien llama. */
function write(configs: readonly SimConfig[]): void {
  const store = storage();
  if (store === null) return;
  try {
    store.setItem(SIM_CONFIGS_KEY, JSON.stringify(configs));
  } catch {
    // Sin sitio o sin permiso: la configuración no se guarda, la simulación sigue igual.
  }
}

/** Guarda `config`, sustituyendo en su sitio la que ya tuviera el mismo `id`. */
export function saveSimConfig(config: SimConfig): void {
  const current = listSimConfigs();
  const at = current.findIndex((entry) => entry.id === config.id);
  const next = [...current];
  if (at === -1) next.push(config);
  else next[at] = config;
  write(next);
}

/** Borra la configuración `id`; una que no exista deja la lista como está. */
export function deleteSimConfig(id: string): void {
  write(listSimConfigs().filter((config) => config.id !== id));
}
