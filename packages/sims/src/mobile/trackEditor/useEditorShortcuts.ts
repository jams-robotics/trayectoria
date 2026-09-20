import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import type { TrackEditorApi } from './useTrackEditor';

// Keyboard shortcuts of the track editor (#126, #159), in their own file so that
// `TrackEditor.tsx` stays under the 300 lines of docs/STANDARDS.md §4.

/**
 * True when `target` is a control that owns its own keys: a shortcut must not steal `Supr` from
 * a numeric field the learner is editing, nor `F` from anything they are typing into.
 */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'select' || tag === 'textarea' || target.isContentEditable;
}

/**
 * `F` sweeps the selected arc the other way and `Supr`/`Delete` removes the selected segment
 * (#159, decision 3). Both are bound on the editor's own container, so they only fire while the
 * focus is inside it, and both go through `commit`, so «Deshacer» takes them back.
 */
export function useSegmentShortcuts(
  editor: TrackEditorApi,
  hostRef: RefObject<HTMLDivElement | null>,
): void {
  const latest = useRef(editor);
  latest.current = editor;
  useEffect(() => {
    const host = hostRef.current;
    if (host === null) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTextEntry(event.target)) return;
      if (latest.current.state.selected === null) return;
      if (event.key === 'Delete') {
        event.preventDefault();
        latest.current.removeSelected();
        return;
      }
      if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        latest.current.flipArc();
      }
    };
    host.addEventListener('keydown', onKeyDown);
    return () => {
      host.removeEventListener('keydown', onKeyDown);
    };
  }, [hostRef]);
}

/** Ctrl+Z undoes and Ctrl+Shift+Z redoes, anywhere in the editor (spec of #126). */
export function useHistoryShortcuts(editor: TrackEditorApi): void {
  const latest = useRef(editor);
  latest.current = editor;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) latest.current.redo();
      else latest.current.undo();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
