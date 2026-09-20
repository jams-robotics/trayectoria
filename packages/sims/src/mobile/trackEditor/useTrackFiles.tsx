import { useCallback, useRef, useState } from 'react';
import type { JSX, RefObject } from 'react';
import { useT } from '@trayectoria/i18n';
import type { PresetName } from '@trayectoria/sim-core';

import { downloadJson, readFileText } from './io-browser';
import type { TrackEditorApi } from './useTrackEditor';

// docs/DESIGN.md §5 (Botón) and §8: a primary and a secondary button, both 44 px tall.
const PRIMARY =
  'bg-primary text-primary-fg rounded-md focus-visible:outline-focus min-h-11 cursor-pointer px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2';
const SECONDARY =
  'border-border bg-bg-raised text-fg rounded-md focus-visible:outline-focus min-h-11 cursor-pointer border px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * What is waiting for the learner to confirm before it replaces the track: a preset by its name,
 * or the empty canvas of «Nueva» (#190, decisiones 1 y 2). Both questions replace everything that
 * is on the canvas, so both go through the same confirmation.
 */
export type PendingReplace = { readonly kind: 'preset'; readonly name: PresetName } | { readonly kind: 'new' };

export interface TrackFiles {
  /** Message of the last failed load, already translated; `null` when the last one went well. */
  error: string | null;
  /** True while the «pista descargada» toast is up. */
  saved: boolean;
  /** Replacement waiting for the learner to confirm; `null` when nothing is being asked. */
  pending: PendingReplace | null;
  save: () => void;
  load: (file: File) => void;
  askPreset: (name: PresetName) => void;
  /** «Nueva»: empties the canvas, asking first when there is something to lose (#190). */
  askNew: () => void;
  confirmPending: () => void;
  cancelPending: () => void;
  dismiss: () => void;
}

/** Lo que `useReplace` devuelve: la pregunta en curso y las cuatro acciones que la mueven. */
type Replace = Pick<
  TrackFiles,
  'pending' | 'askPreset' | 'askNew' | 'confirmPending' | 'cancelPending'
>;

/**
 * Lo que sustituye la pista entera y su confirmación: un preset (spec de #126) o el lienzo vacío
 * de «Nueva» (#190, decisiones 1 y 2). El preset pregunta cuando hay trabajo sin guardar; «Nueva»
 * lo hace cuando hay segmentos, guardados o no: vaciar el lienzo es perderlos de vista igual.
 */
function useReplace(latest: RefObject<TrackEditorApi>): Replace {
  const [pending, setPending] = useState<PendingReplace | null>(null);
  return {
    pending,
    askPreset: useCallback(
      (name: PresetName): void => {
        if (latest.current.dirty) setPending({ kind: 'preset', name });
        else latest.current.applyPreset(name);
      },
      [latest],
    ),
    askNew: useCallback((): void => {
      if (latest.current.state.track.segments.length > 0) setPending({ kind: 'new' });
      else latest.current.newTrack();
    }, [latest]),
    confirmPending: useCallback((): void => {
      setPending((current) => {
        if (current === null) return null;
        if (current.kind === 'new') latest.current.newTrack();
        else latest.current.applyPreset(current.name);
        return null;
      });
    }, [latest]),
    cancelPending: useCallback((): void => {
      setPending(null);
    }, [latest]),
  };
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
  const latest = useRef(editor);
  latest.current = editor;
  const { pending, askPreset, askNew, confirmPending, cancelPending } = useReplace(latest);
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
  const dismiss = useCallback((): void => {
    setSaved(false);
  }, []);
  return { error, saved, pending, save, load, askPreset, askNew, confirmPending, cancelPending, dismiss };
}

export interface ConfirmReplaceProps {
  pending: PendingReplace | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * La confirmación en línea de lo que reemplaza la pista entera: un preset sobre trabajo sin
 * guardar (spec de #126) o el lienzo vacío de «Nueva» (#190, decisiones 1 y 2). Es el patrón
 * `ConfirmInline` de F3-02a —pregunta, un «sí» secundario y un «no» fantasma—, que vive en
 * `apps/web` y no puede importarse desde aquí (docs/ARCHITECTURE.md §2), así que se reproduce su
 * forma con los tokens de docs/DESIGN.md §5.
 */
export function ConfirmReplace({
  pending,
  onConfirm,
  onCancel,
}: ConfirmReplaceProps): JSX.Element | null {
  const t = useT();
  if (pending === null) return null;
  const isNew = pending.kind === 'new';
  const question = t(isNew ? 'sims.trackEditor.newConfirm' : 'sims.trackEditor.presetConfirm');
  const yes = t(isNew ? 'sims.trackEditor.newConfirmAccept' : 'sims.trackEditor.presetConfirmAccept');
  const no = t(isNew ? 'sims.trackEditor.newConfirmCancel' : 'sims.trackEditor.presetConfirmCancel');
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={question}
      data-testid="track-editor-confirm"
      className="border-border bg-bg-raised rounded-md flex flex-wrap items-center gap-3 border p-4 text-sm"
    >
      <p>{question}</p>
      <button type="button" onClick={onConfirm} aria-label={yes} className={PRIMARY}>
        {yes}
      </button>
      <button type="button" onClick={onCancel} aria-label={no} className={SECONDARY}>
        {no}
      </button>
    </div>
  );
}
