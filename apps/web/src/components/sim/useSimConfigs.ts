import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@trayectoria/i18n';
import type { SimConfig } from '@trayectoria/sims';
import type { ToastTone } from '@trayectoria/widgets';

import { CATALOG_PREFIX, MY_ROBOT_ID } from './RobotSource';

// F4-05 (#131, decisiones 4, 5 y 7): dónde viven las configuraciones guardadas y cómo llega la
// del enlace. La página no escribe en `localStorage` ni consulta Supabase por su cuenta: lo
// primero es el store de `@trayectoria/sims` (el único archivo con `localStorage`) y lo segundo el
// adaptador de `apps/web/src/lib/sim/simConfigPersistence.ts`, que se carga con `import()` para no
// meter `@supabase/supabase-js` en el JS inicial de una página que simula igual sin sesión.

/** Un aviso de la página: el mensaje ya traducido y su tono (docs/DESIGN.md §5, Toast). */
export interface Notice {
  readonly message: string;
  readonly tone: ToastTone;
}

/**
 * El robot en el que se guarda con sesión: una fila de `robots`, no «Mi robot» ni uno de
 * referencia (decisión 5). Para esos dos la lista es la local.
 */
export function savedRobotIdOf(robotId: string): string | null {
  if (robotId === MY_ROBOT_ID || robotId.startsWith(CATALOG_PREFIX)) return null;
  return robotId;
}

/** El id del estudiante con sesión, o `null` sin ella; espera a que la sesión esté leída. */
async function currentOwnerId(): Promise<string | null> {
  const { ensureSessionReady } = await import('@trayectoria/auth');
  const session = await ensureSessionReady();
  return session?.user.id ?? null;
}

/** La lista guardada del robot con sesión, o la local cuando no la hay. */
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

/** Guarda `config` donde corresponda y devuelve la lista resultante. */
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

/** Borra `id` donde corresponda y devuelve la lista resultante. */
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

/** La configuración del enlace `?c=`, o `'invalid'` si lo hay pero no vale; `null` si no lo hay. */
export async function configFromSearch(search: string): Promise<SimConfig | 'invalid' | null> {
  const { SHARE_PARAM, decode } = await import('@trayectoria/sims');
  const text = new URLSearchParams(search).get(SHARE_PARAM);
  if (text === null) return null;
  const result = await decode(text);
  return result.ok ? result.value : 'invalid';
}

export interface SimConfigsApi {
  /** Las configuraciones que la página muestra: las del robot con sesión, o las locales. */
  readonly saved: readonly SimConfig[];
  readonly onSave: (name: string, current: Omit<SimConfig, 'id' | 'name'>) => void;
  readonly onDelete: (id: string) => void;
  /** `false` con `'tooLong'` significa que no hubo enlace que copiar: la configuración no cabe. */
  readonly onCopied: (copied: boolean, reason?: 'tooLong') => void;
  /** El aviso en curso y cómo cerrarlo. */
  readonly notice: Notice | null;
  readonly dismiss: () => void;
}

/** Las configuraciones que la página muestra: las del robot con sesión, o las locales. */
function useSavedList(robotId: string): {
  saved: readonly SimConfig[];
  setSaved: (list: readonly SimConfig[]) => void;
} {
  const [saved, setSaved] = useState<readonly SimConfig[]>([]);
  // La lista se relee cada vez que cambia el robot: con «Mi robot» o uno de referencia es la
  // local, y con un robot guardado la de su fila (decisión 5).
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
 * Aplica el enlace `?c=` al montar, una sola vez: la URL no se reescribe al guardar (decisión 7),
 * así que nada vuelve a disparar esto, y volver a aplicarlo borraría lo que el estudiante haya
 * cambiado desde entonces. Un enlace que no vale deja los valores por defecto y avisa.
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

/** «Guardar» y «Borrar»: escriben donde toque y publican la lista que devuelve la escritura. */
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
 * Las configuraciones guardadas del robot seleccionado y las acciones del panel, con el enlace
 * `?c=` aplicado al montar. `applyConfig` es el de la página: es ella quien cambia pista,
 * controlador, parámetros y semilla, y quien reinicia la simulación pausada en `t = 0`.
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

  // #182 (decisión 2): «Copiar enlace» con una configuración que no cabe no copia nada y lo dice
  // con su propio aviso; el del portapapeles no valdría, porque no hay enlace a la vista.
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
