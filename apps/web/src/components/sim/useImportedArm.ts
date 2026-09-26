import { useCallback, useEffect, useState } from 'react';

import type { AcceptedUpload } from '../robots/UploadUrdfForm';
import type { ImportedArm } from './importedArms';
import { saveErrorKey } from '../../lib/robots/storage';
import { IMPORTED_VALUE, savedIdOf } from './ArmSource';

// F5-04 (#137, decisions 3, 4 and 5): the state of the imported arm of `/simuladores/brazo`, out
// of `ArmSimIsland.tsx` so that neither of the two goes over 300 lines (docs/STANDARDS.md §4).
// `importedArms.ts` is loaded with `import()`, so `@supabase/supabase-js` does not enter the
// page's initial JS.

/** An arm the viewer draws from an in-memory zip. */
export interface MemoryArm {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly urdfPath: string;
}

/** The state of the selector and the dialog that `ArmSimIsland` consumes. */
export interface ImportState {
  readonly savedArms: readonly ImportedArm[];
  readonly signedIn: boolean;
  readonly dialogOpen: boolean;
  readonly memoryArm: MemoryArm | null;
  readonly notice: string;
  readonly openDialog: () => void;
  readonly closeDialog: () => void;
  readonly accept: (upload: AcceptedUpload) => Promise<void>;
  /** Loads a saved arm; `true` when it succeeded. */
  readonly selectSaved: (value: string) => Promise<boolean>;
  readonly clearMemoryArm: () => void;
}

/** The `.urdf` entry of an already checked zip; `validateUpload` guarantees there is exactly one. */
function urdfPathOf(paths: readonly string[]): string {
  return paths.find((path) => path.toLowerCase().endsWith('.urdf')) ?? '';
}

/** The learner's session and their saved arms; without a session, the empty list. */
async function readSession(): Promise<{
  ownerId: string | null;
  arms: readonly ImportedArm[];
}> {
  const module = await import('./importedArms');
  const ownerId = await module.currentOwnerId();
  const empty: readonly ImportedArm[] = [];
  return { ownerId, arms: ownerId === null ? empty : await module.loadImportedArms() };
}

/** The session and the saved arms, loaded once on mount. */
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

/** Accepts an already checked zip: saves it if there is a session and always loads it in the viewer. */
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
      // The session is read again here: when the island mounts it may not be resolved yet, and the
      // learner decides to import much later (`packages/auth`, `$sessionReady`).
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
      // The zip is already checked: if Supabase rejects it, the arm is loaded in memory anyway.
      setNotice(typeof saved === 'string' ? saved : 'sims.import.saved');
    },
    [ownerId, add, show, setNotice, setDialogOpen],
  );
}

/** Downloads the zip of a saved arm and gets it ready for the viewer (#137, decision 5). */
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
 * The complete import flow: opening the dialog, accepting a checked zip (saving it if
 * there is a session) and loading an already saved arm from its own bucket.
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
