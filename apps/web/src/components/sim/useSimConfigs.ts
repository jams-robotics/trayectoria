import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@trayectoria/i18n';
import type { SimConfig } from '@trayectoria/sims';
import type { ToastTone } from '@trayectoria/widgets/Toast';

import { CATALOG_PREFIX, MY_ROBOT_ID } from './RobotSource';

// F4-05 (#131, decisions 4, 5 and 7): where the saved configurations live and how the link's one
// arrives. The page neither writes to `localStorage` nor queries Supabase on its own: the
// first is the `@trayectoria/sims` store (the only file with `localStorage`) and the second the
// adapter of `apps/web/src/lib/sim/simConfigPersistence.ts`, which is loaded with `import()` so as
// not to put `@supabase/supabase-js` in the initial JS of a page that simulates just as well without a session.

/** A page notice: the already translated message and its tone (docs/DESIGN.md §5, Toast). */
export interface Notice {
  readonly message: string;
  readonly tone: ToastTone;
}

/**
 * The robot saved into with a session: a `robots` row, not «Mi robot» nor a reference
 * one (decision 5). For those two the list is the local one.
 */
export function savedRobotIdOf(robotId: string): string | null {
  if (robotId === MY_ROBOT_ID || robotId.startsWith(CATALOG_PREFIX)) return null;
  return robotId;
}

/** The signed-in learner's id, or `null` without a session; waits until the session is read. */
async function currentOwnerId(): Promise<string | null> {
  const { ensureSessionReady } = await import('@trayectoria/auth');
  const session = await ensureSessionReady();
  return session?.user.id ?? null;
}

/** The saved list of the robot with a session, or the local one when there is none. */
async function loadList(robotId: string): Promise<readonly SimConfig[]> {
  const { listSimConfigs } = await import('@trayectoria/sims');
  const saved = savedRobotIdOf(robotId);
  if (saved === null) return listSimConfigs();
  const ownerId = await currentOwnerId();
  if (ownerId === null) return listSimConfigs();
  const { listRobotSimConfigs } = await import('../../lib/sim/simConfigPersistence');
  return listRobotSimConfigs(saved, ownerId);
}

/**
 * The notice of a failed write: its own one when the spec of the robot would go over the size
 * bound, which `simConfigPersistence.ts` reports with a `RangeError` (#210).
 */
export function saveErrorKey(error: unknown): string {
  return error instanceof RangeError ? 'sims.simConfig.tooLarge' : 'sims.simConfig.saveError';
}

/** Saves `config` where it belongs and returns the resulting list. */
async function storeConfig(
  robotId: string,
  config: SimConfig,
): Promise<readonly SimConfig[]> {
  const sims = await import('@trayectoria/sims');
  const saved = savedRobotIdOf(robotId);
  const ownerId = saved === null ? null : await currentOwnerId();
  if (saved === null || ownerId === null) {
    sims.saveSimConfig(config);
    return sims.listSimConfigs();
  }
  const { saveRobotSimConfig } = await import('../../lib/sim/simConfigPersistence');
  return saveRobotSimConfig(saved, ownerId, config);
}

/** Deletes `id` where it belongs and returns the resulting list. */
async function removeConfig(robotId: string, id: string): Promise<readonly SimConfig[]> {
  const sims = await import('@trayectoria/sims');
  const saved = savedRobotIdOf(robotId);
  const ownerId = saved === null ? null : await currentOwnerId();
  if (saved === null || ownerId === null) {
    sims.deleteSimConfig(id);
    return sims.listSimConfigs();
  }
  const { deleteRobotSimConfig } = await import('../../lib/sim/simConfigPersistence');
  return deleteRobotSimConfig(saved, ownerId, id);
}

/** The configuration of the `?c=` link, or `'invalid'` if there is one but it is not valid; `null` if there is none. */
export async function configFromSearch(search: string): Promise<SimConfig | 'invalid' | null> {
  const { SHARE_PARAM, decode } = await import('@trayectoria/sims');
  const text = new URLSearchParams(search).get(SHARE_PARAM);
  if (text === null) return null;
  const result = await decode(text);
  return result.ok ? result.value : 'invalid';
}

export interface SimConfigsApi {
  /** The configurations the page shows: those of the robot with a session, or the local ones. */
  readonly saved: readonly SimConfig[];
  readonly onSave: (name: string, current: Omit<SimConfig, 'id' | 'name'>) => void;
  readonly onDelete: (id: string) => void;
  /** `false` with `'tooLong'` means there was no link to copy: the configuration does not fit. */
  readonly onCopied: (copied: boolean, reason?: 'tooLong') => void;
  /** The current notice and how to dismiss it. */
  readonly notice: Notice | null;
  readonly dismiss: () => void;
}

/** The configurations the page shows: those of the robot with a session, or the local ones. */
function useSavedList(robotId: string): {
  saved: readonly SimConfig[];
  setSaved: (list: readonly SimConfig[]) => void;
} {
  const [saved, setSaved] = useState<readonly SimConfig[]>([]);
  // The list is re-read every time the robot changes: with «Mi robot» or a reference one it is the
  // local one, and with a saved robot that of its row (decision 5).
  useEffect(() => {
    let live = true;
    void loadList(robotId)
      .then((list) => {
        if (live) setSaved(list);
      })
      .catch(() => {
        if (live) setSaved([]);
      });
    return () => {
      live = false;
    };
  }, [robotId]);
  return { saved, setSaved };
}

/**
 * Applies the `?c=` link on mount, only once: the URL is not rewritten on save (decision 7),
 * so nothing triggers this again, and applying it again would erase whatever the learner has
 * changed since then. An invalid link leaves the default values and warns.
 */
function useLinkedConfig(
  applyConfig: (config: SimConfig) => void,
  onInvalid: () => void,
): void {
  const latest = useRef({ applyConfig, onInvalid });
  latest.current = { applyConfig, onInvalid };
  useEffect(() => {
    let live = true;
    void configFromSearch(location.search).then((config) => {
      if (!live || config === null) return;
      if (config === 'invalid') latest.current.onInvalid();
      else latest.current.applyConfig(config);
    });
    return () => {
      live = false;
    };
  }, []);
}

/** «Guardar» and «Borrar»: they write where appropriate and publish the list the write returns. */
function useWriteActions(
  robotId: string,
  setSaved: (list: readonly SimConfig[]) => void,
  onError: (error: unknown) => void,
): {
  onSave: (name: string, current: Omit<SimConfig, 'id' | 'name'>) => void;
  onDelete: (id: string) => void;
} {
  const latest = useRef({ setSaved, onError });
  latest.current = { setSaved, onError };
  const onSave = useCallback(
    (name: string, current: Omit<SimConfig, 'id' | 'name'>): void => {
      const config: SimConfig = { id: crypto.randomUUID(), name, ...current };
      void storeConfig(robotId, config)
        .then((list) => {
          latest.current.setSaved(list);
        })
        .catch((error: unknown) => {
          latest.current.onError(error);
        });
    },
    [robotId],
  );
  const onDelete = useCallback(
    (id: string): void => {
      void removeConfig(robotId, id)
        .then((list) => {
          latest.current.setSaved(list);
        })
        .catch((error: unknown) => {
          latest.current.onError(error);
        });
    },
    [robotId],
  );
  return { onSave, onDelete };
}

/**
 * The saved configurations of the selected robot and the panel actions, with the
 * `?c=` link applied on mount. `applyConfig` is the page's: it is the page that changes track,
 * controller, parameters and seed, and that restarts the simulation paused at `t = 0`.
 */
export function useSimConfigs(
  robotId: string,
  applyConfig: (config: SimConfig) => void,
): SimConfigsApi {
  const t = useT();
  const { saved, setSaved } = useSavedList(robotId);
  const [notice, setNotice] = useState<Notice | null>(null);

  useLinkedConfig(applyConfig, () => {
    setNotice({ message: t('sims.simConfig.invalidLink'), tone: 'error' });
  });

  const { onSave, onDelete } = useWriteActions(robotId, setSaved, (error) => {
    setNotice({ message: t(saveErrorKey(error)), tone: 'error' });
  });

  // #182 (decision 2): «Copiar enlace» with a configuration that does not fit copies nothing and says so
  // with its own notice; the clipboard one would not do, because there is no link in sight.
  const onCopied = useCallback(
    (copied: boolean, reason?: 'tooLong'): void => {
      if (reason === 'tooLong') {
        setNotice({ message: t('sims.simConfig.linkTooLong'), tone: 'error' });
        return;
      }
      setNotice(
        copied
          ? { message: t('sims.simConfig.copied'), tone: 'success' }
          : { message: t('sims.simConfig.copyError'), tone: 'error' },
      );
    },
    [t],
  );

  const dismiss = useCallback((): void => {
    setNotice(null);
  }, []);

  return { saved, onSave, onDelete, onCopied, notice, dismiss };
}
