import { useCallback, useState } from 'react';

// #190 (decision 3): split from `useMobileSimState.ts` to keep that file under the limit
// of docs/STANDARDS.md §4. It is still the same hook: what fills the viewer box and how it
// changes (#158, decisions 1 and 3).

/**
 * What fills the viewer box: the simulation or the track editor (#158, decision 1). The editor
 * replaces the viewer in the same box; it is not a panel that unfolds under the right column.
 */
export type SimView = 'sim' | 'editor';

/**
 * What fills the viewer box and how it changes (#158, decisions 1 and 3). «Volver a la simulación»
 * only returns the box to the viewer: the edited track already arrived through `onTrack` on every editor
 * change, and the paused restart at `t = 0` is requested by the island, which holds the widget's api.
 */
export function useSimView(): {
  view: SimView;
  openEditor: () => void;
  openNewEditor: () => void;
  closeEditor: () => void;
  /** True while the open editor started from the empty canvas (#190, decision 3). */
  fromEmpty: boolean;
} {
  const [view, setView] = useState<SimView>('sim');
  const [fromEmpty, setFromEmpty] = useState(false);
  const openEditor = useCallback((): void => {
    setFromEmpty(false);
    setView('editor');
  }, []);
  const openNewEditor = useCallback((): void => {
    setFromEmpty(true);
    setView('editor');
  }, []);
  const closeEditor = useCallback((): void => {
    setView('sim');
  }, []);
  return { view, openEditor, openNewEditor, closeEditor, fromEmpty };
}
