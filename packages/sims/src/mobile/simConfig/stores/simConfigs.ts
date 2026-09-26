import type { SimConfig } from '@trayectoria/robot-spec';

import { parseSimConfig } from '../codec';

// F4-05 (#131, decision 4): the configurations saved in the browser. It is the only file of the
// deliverable that touches `localStorage` (docs/STANDARDS.md §10), so the panel and the Supabase
// adapter do not even mention it.
//
// What is saved is a list of `SimConfig` validated on read with the robot-spec schema: an
// entry that does not meet it —from an older version, from another tab or hand-written— is
// dropped instead of breaking the page. Nothing here throws: with no session and no
// storage the simulator keeps working, only without a list.

/** `localStorage` key where the list lives (ticket spec). */
export const SIM_CONFIGS_KEY = 'trayectoria.simConfigs';

/** The browser storage, or `null` where there is none (SSR, tests, restricted mode). */
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The saved configurations, in the order they were saved; invalid ones are dropped. */
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

/** Writes the whole list; a full or blocked storage does not break the caller. */
function write(configs: readonly SimConfig[]): void {
  const store = storage();
  if (store === null) return;
  try {
    store.setItem(SIM_CONFIGS_KEY, JSON.stringify(configs));
  } catch {
    // No room or no permission: the configuration is not saved, the simulation carries on the same.
  }
}

/** Saves `config`, replacing in place the one that already had the same `id`. */
export function saveSimConfig(config: SimConfig): void {
  const current = listSimConfigs();
  const at = current.findIndex((entry) => entry.id === config.id);
  const next = [...current];
  if (at === -1) next.push(config);
  else next[at] = config;
  write(next);
}

/** Deletes the configuration `id`; one that does not exist leaves the list as it is. */
export function deleteSimConfig(id: string): void {
  write(listSimConfigs().filter((config) => config.id !== id));
}
