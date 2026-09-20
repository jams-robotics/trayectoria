import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@trayectoria/i18n';
import type { SavedTrack } from '@trayectoria/sims';

import { loadSavedTracks, removeSavedTrack, storeSavedTrack } from './savedTracks';
import type { Track } from './savedTracks';
import type { Notice } from './useSimConfigs';

// F4-06 (#191, decision 2): the saved tracks the picker shows and the actions that write them.
// Where each one is saved — the account or the browser — is decided by `savedTracks.ts`; what
// lives here is only the state of the page and the notice of each outcome.

export interface SavedTracksApi {
  /** The tracks the «Mis pistas» group of the picker shows, most recently saved first. */
  readonly saved: readonly SavedTrack[];
  /** Saves the track of the editor; the list is read again and the saved one stays selected. */
  readonly onSave: (name: string, track: Track) => Promise<void>;
  readonly onDelete: (id: string) => void;
  /** Id of the saved track the page is simulating, or `null` when it is another one. */
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  /** The notice being shown and how to close it; the same `Toast` as the rest of the page. */
  readonly notice: Notice | null;
  readonly dismiss: () => void;
}

/** The saved list, read on mount and every time a write hands back a new one. */
function useSavedList(onError: () => void): {
  saved: readonly SavedTrack[];
  setSaved: (list: readonly SavedTrack[]) => void;
} {
  const [saved, setSaved] = useState<readonly SavedTrack[]>([]);
  const latest = useRef(onError);
  latest.current = onError;
  useEffect(() => {
    let live = true;
    void loadSavedTracks()
      .then((list) => {
        if (live) setSaved(list);
      })
      .catch(() => {
        if (live) latest.current();
      });
    return () => {
      live = false;
    };
  }, []);
  return { saved, setSaved };
}

/** What writes and what deletes; both publish the list the write hands back. */
function useWriteActions(
  setSaved: (list: readonly SavedTrack[]) => void,
  setSelectedId: (update: (current: string | null) => string | null) => void,
  ok: (key: string) => void,
  fail: (key: string) => void,
): Pick<SavedTracksApi, 'onSave' | 'onDelete'> {
  const latest = useRef({ setSaved, setSelectedId, ok, fail });
  latest.current = { setSaved, setSelectedId, ok, fail };
  const onSave = useCallback(async (name: string, track: Track): Promise<void> => {
    try {
      const list = await storeSavedTrack(name, track);
      latest.current.setSaved(list);
      const id = list.find((entry) => entry.name === name)?.id ?? null;
      latest.current.setSelectedId(() => id);
      latest.current.ok('sims.trackEditor.save.saved');
    } catch {
      latest.current.fail('sims.trackEditor.save.error');
    }
  }, []);
  const onDelete = useCallback((id: string): void => {
    void removeSavedTrack(id)
      .then((list) => {
        latest.current.setSaved(list);
        latest.current.setSelectedId((current) => (current === id ? null : current));
      })
      .catch(() => {
        latest.current.fail('sims.mobilePage.myTracks.deleteError');
      });
  }, []);
  return { onSave, onDelete };
}

/**
 * The saved tracks of the student and the actions of the picker. `onLoad` is the page's own: it
 * is the page that changes the current track and restarts the simulation at `t = 0`.
 */
export function useSavedTracks(onLoad: (track: Track) => void): SavedTracksApi {
  const t = useT();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fail = useCallback(
    (key: string): void => {
      setNotice({ message: t(key), tone: 'error' });
    },
    [t],
  );
  const ok = useCallback(
    (key: string): void => {
      setNotice({ message: t(key), tone: 'success' });
    },
    [t],
  );
  const { saved, setSaved } = useSavedList(() => {
    fail('sims.mobilePage.myTracks.listError');
  });
  const { onSave, onDelete } = useWriteActions(setSaved, setSelectedId, ok, fail);
  const latest = useRef({ saved, onLoad });
  latest.current = { saved, onLoad };

  const onSelect = useCallback((id: string): void => {
    const picked = latest.current.saved.find((entry) => entry.id === id);
    if (picked === undefined) return;
    setSelectedId(id);
    latest.current.onLoad(picked.track);
  }, []);

  const dismiss = useCallback((): void => {
    setNotice(null);
  }, []);

  return { saved, onSave, onDelete, selectedId, onSelect, notice, dismiss };
}
