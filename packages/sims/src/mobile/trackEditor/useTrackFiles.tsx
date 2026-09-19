import { useCallback, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { PresetName } from '@trayectoria/sim-core';

import { downloadJson, readFileText } from './io-browser';
import type { TrackEditorApi } from './useTrackEditor';

// docs/DESIGN.md §5 (Botón) and §8: a primary and a secondary button, both 44 px tall.
const PRIMARY =
  'bg-primary text-primary-fg rounded-md focus-visible:outline-focus min-h-11 cursor-pointer px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2';
const SECONDARY =
  'border-border bg-bg-raised text-fg rounded-md focus-visible:outline-focus min-h-11 cursor-pointer border px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2';

export interface TrackFiles {
  /** Message of the last failed load, already translated; `null` when the last one went well. */
  error: string | null;
  /** True while the «pista descargada» toast is up. */
  saved: boolean;
  /** Preset waiting for the learner to confirm replacing unsaved work. */
  pending: PresetName | null;
  save: () => void;
  load: (file: File) => void;
  askPreset: (name: PresetName) => void;
  confirmPreset: () => void;
  cancelPreset: () => void;
  dismiss: () => void;
}

/**
 * Saving, loading and the preset confirmation of the editor: everything that takes the track out
 * of the page or replaces it wholesale. A preset over unsaved work asks first (spec of #126); a
 * file that is not a track comes back as a message and leaves the track exactly as it was.
 */
export function useTrackFiles(editor: TrackEditorApi): TrackFiles {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState<PresetName | null>(null);
  const latest = useRef(editor);
  latest.current = editor;
  const save = useCallback((): void => {
    downloadJson(latest.current.toJson());
    latest.current.markSaved();
    setError(null);
    setSaved(true);
  }, []);
  const load = useCallback(
    (file: File): void => {
      void readFileText(file).then((text) => {
        const reason = latest.current.loadJson(text);
        setError(reason === null ? null : t('sims.trackEditor.loadError', { reason }));
      });
    },
    [t],
  );
  const askPreset = useCallback((name: PresetName): void => {
    if (latest.current.dirty) setPending(name);
    else latest.current.applyPreset(name);
  }, []);
  const confirmPreset = useCallback((): void => {
    setPending((name) => {
      if (name !== null) latest.current.applyPreset(name);
      return null;
    });
  }, []);
  const cancelPreset = useCallback((): void => {
    setPending(null);
  }, []);
  const dismiss = useCallback((): void => {
    setSaved(false);
  }, []);
  return { error, saved, pending, save, load, askPreset, confirmPreset, cancelPreset, dismiss };
}

export interface PresetDialogProps {
  pending: PresetName | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The confirmation shown before a preset overwrites unsaved work (spec of #126). */
export function PresetDialog({
  pending,
  onConfirm,
  onCancel,
}: PresetDialogProps): JSX.Element | null {
  const t = useT();
  if (pending === null) return null;
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t('sims.trackEditor.presetConfirm')}
      className="border-border bg-bg-raised rounded-md flex flex-wrap items-center gap-3 border p-4 text-sm"
    >
      <p>{t('sims.trackEditor.presetConfirm')}</p>
      <button type="button" onClick={onConfirm} className={PRIMARY}>
        {t('sims.trackEditor.presetConfirmAccept')}
      </button>
      <button type="button" onClick={onCancel} className={SECONDARY}>
        {t('sims.trackEditor.presetConfirmCancel')}
      </button>
    </div>
  );
}
