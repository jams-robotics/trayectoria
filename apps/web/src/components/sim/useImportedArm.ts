import { useCallback, useEffect, useState } from 'react';

import type { AcceptedUpload } from '../robots/UploadUrdfForm';
import type { ImportedArm } from './importedArms';
import { saveErrorKey } from '../../lib/robots/storage';
import { IMPORTED_VALUE, savedIdOf } from './ArmSource';

// F5-04 (#137, decisiones 3, 4 y 5): el estado del brazo importado de `/simuladores/brazo`, fuera
// de `ArmSimIsland.tsx` para que ninguno de los dos pase de 300 líneas (docs/STANDARDS.md §4).
// `importedArms.ts` se carga con `import()`, así que `@supabase/supabase-js` no entra en el JS
// inicial de la página.

/** Un brazo que el visor dibuja desde un zip en memoria. */
export interface MemoryArm {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly urdfPath: string;
}

/** El estado del selector y del diálogo que `ArmSimIsland` consume. */
export interface ImportState {
  readonly savedArms: readonly ImportedArm[];
  readonly signedIn: boolean;
  readonly dialogOpen: boolean;
  readonly memoryArm: MemoryArm | null;
  readonly notice: string;
  readonly openDialog: () => void;
  readonly closeDialog: () => void;
  readonly accept: (upload: AcceptedUpload) => Promise<void>;
  /** Carga un brazo guardado; `true` cuando lo consiguió. */
  readonly selectSaved: (value: string) => Promise<boolean>;
  readonly clearMemoryArm: () => void;
}

/** La entrada `.urdf` de un zip ya comprobado; `validateUpload` garantiza que hay exactamente una. */
function urdfPathOf(paths: readonly string[]): string {
  return paths.find((path) => path.toLowerCase().endsWith('.urdf')) ?? '';
}

/** La sesión del estudiante y sus brazos guardados; sin sesión, la lista vacía. */
async function readSession(): Promise<{
  ownerId: string | null;
  arms: readonly ImportedArm[];
}> {
  const module = await import('./importedArms');
  const ownerId = await module.currentOwnerId();
  const empty: readonly ImportedArm[] = [];
  return { ownerId, arms: ownerId === null ? empty : await module.loadImportedArms() };
}

/** La sesión y los brazos guardados, cargados una vez al montar. */
function useSavedArms(): {
  savedArms: readonly ImportedArm[];
  ownerId: string | null;
  add: (arm: ImportedArm) => void;
} {
  const [savedArms, setSavedArms] = useState<readonly ImportedArm[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void readSession()
      .then((result) => {
        if (!live) return;
        setOwnerId(result.ownerId);
        setSavedArms(result.arms);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const add = useCallback((arm: ImportedArm): void => {
    setSavedArms((current) => [...current.filter((one) => one.id !== arm.id), arm]);
  }, []);

  return { savedArms, ownerId, add };
}

/**
 * Saves the zip as an arm of the learner, or returns the key of the notice when it is not saved:
 * its own one when the spec is over the size bound of `robots.spec` (#210).
 */
async function saveOrNotice(
  ownerId: string,
  upload: AcceptedUpload,
): Promise<ImportedArm | string> {
  try {
    const module = await import('./importedArms');
    return await module.saveImportedArm({
      ownerId,
      robotId: upload.robotId,
      spec: upload.spec,
      zipBytes: upload.zipBytes,
    });
  } catch (error) {
    return saveErrorKey(error, 'sims.import.saveFailed');
  }
}

/** Acepta un zip ya comprobado: lo guarda si hay sesión y en todo caso lo carga en el visor. */
function useAccept(options: {
  ownerId: string | null;
  add: (arm: ImportedArm) => void;
  show: (arm: MemoryArm) => void;
  setNotice: (key: string) => void;
  setDialogOpen: (open: boolean) => void;
}): (upload: AcceptedUpload) => Promise<void> {
  const { ownerId, add, show, setNotice, setDialogOpen } = options;
  return useCallback(
    async (upload) => {
      const arm: MemoryArm = {
        name: upload.spec.name,
        bytes: upload.zipBytes,
        urdfPath: urdfPathOf(upload.paths),
      };
      setDialogOpen(false);
      // La sesión se vuelve a leer aquí: al montar la isla puede no estar resuelta todavía, y el
      // estudiante decide importar mucho después (`packages/auth`, `$sessionReady`).
      const module = await import('./importedArms');
      const owner = ownerId ?? (await module.currentOwnerId());
      if (owner === null) {
        show(arm);
        setNotice('sims.import.loaded');
        return;
      }
      const saved = await saveOrNotice(owner, upload);
      if (typeof saved !== 'string') add(saved);
      show(arm);
      // El zip ya está comprobado: si Supabase lo rechaza, el brazo se carga igual en memoria.
      setNotice(typeof saved === 'string' ? saved : 'sims.import.saved');
    },
    [ownerId, add, show, setNotice, setDialogOpen],
  );
}

/** Descarga el zip de un brazo guardado y lo deja listo para el visor (#137, decisión 5). */
function useSelectSaved(
  savedArms: readonly ImportedArm[],
  setMemoryArm: (arm: MemoryArm) => void,
  setNotice: (key: string) => void,
): (value: string) => Promise<boolean> {
  return useCallback(
    async (value) => {
      const id = savedIdOf(value);
      const saved = savedArms.find((arm) => arm.id === id);
      if (saved === undefined) return false;
      try {
        const module = await import('./importedArms');
        const bytes = await module.fetchArmZip(saved.urdfPath);
        const { listEntries } = await import('@trayectoria/sims/urdf');
        const urdfPath = urdfPathOf(listEntries(bytes).map((entry) => entry.path));
        if (urdfPath === '') throw new Error('sims.import.downloadFailed');
        setMemoryArm({ name: saved.name, bytes, urdfPath });
        setNotice('');
        return true;
      } catch {
        setNotice('sims.import.downloadFailed');
        return false;
      }
    },
    [savedArms, setMemoryArm, setNotice],
  );
}

/**
 * El flujo de importación completo: abrir el diálogo, aceptar un zip comprobado —guardándolo si
 * hay sesión— y cargar un brazo ya guardado desde el propio bucket.
 */
export function useImportedArm(onSelect: (value: string) => void): ImportState {
  const { savedArms, ownerId, add } = useSavedArms();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [memoryArm, setMemoryArm] = useState<MemoryArm | null>(null);
  const [notice, setNotice] = useState('');

  const show = useCallback(
    (arm: MemoryArm): void => {
      setMemoryArm(arm);
      onSelect(IMPORTED_VALUE);
    },
    [onSelect],
  );

  const accept = useAccept({ ownerId, add, show, setNotice, setDialogOpen });
  const selectSaved = useSelectSaved(savedArms, setMemoryArm, setNotice);

  return {
    savedArms,
    signedIn: ownerId !== null,
    dialogOpen,
    memoryArm,
    notice,
    openDialog: useCallback(() => {
      setNotice('');
      setDialogOpen(true);
    }, []),
    closeDialog: useCallback(() => {
      setDialogOpen(false);
    }, []),
    accept,
    selectSaved,
    clearMemoryArm: useCallback(() => {
      setMemoryArm(null);
    }, []),
  };
}
