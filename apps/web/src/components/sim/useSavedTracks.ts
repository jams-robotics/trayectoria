import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@trayectoria/i18n';
import type { SavedTrack } from '@trayectoria/sims';

import { loadSavedTracks, removeSavedTrack, storeSavedTrack } from './savedTracks';
import type { Track } from './savedTracks';
import type { Notice } from './useSimConfigs';

// F4-06 (#191, decisión 2): las pistas guardadas que el selector muestra y las acciones que las
// escriben. Dónde se guarda cada una —la cuenta o el navegador— lo decide `savedTracks.ts`; aquí
// solo vive el estado de la página y el aviso de cada resultado.

export interface SavedTracksApi {
  /** Las pistas que el grupo «Mis pistas» del selector muestra, de la más reciente a la más antigua. */
  readonly saved: readonly SavedTrack[];
  /** Guarda la pista del editor; la lista se recarga y la guardada queda seleccionada. */
  readonly onSave: (name: string, track: Track) => Promise<void>;
  readonly onDelete: (id: string) => void;
  /** El id de la pista guardada que la página está simulando, o `null` si es otra. */
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
  /** El aviso en curso y cómo cerrarlo; lo pinta el mismo `Toast` que el resto de la página. */
  readonly notice: Notice | null;
  readonly dismiss: () => void;
}

/** La lista guardada, releída al montar y cada vez que una escritura la devuelve. */
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

/** Lo que escribe y lo que borra; ambas publican la lista que la escritura devuelve. */
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
 * Las pistas guardadas del estudiante y las acciones del selector. `onLoad` es el de la página:
 * es ella quien cambia la pista en curso y reinicia la simulación en `t = 0`.
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
