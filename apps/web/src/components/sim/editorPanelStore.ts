import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

// #189 (decisions 1 and 2): the channel through which the numeric panel of the track editor
// travels from the viewer box (where `TrackEditor` hands it over via `renderPanel`) to the right
// column of the page, which is where decision 2 places it.
//
// It is the same pattern as `apiStore` and `instrumentsStore`: the box and the column are siblings
// inside the widget tree (one arrives via `renderViewer` and the other via `renderPanel`), so
// there is no common parent that could pass them the node through props without re-rendering the
// whole page on every editor change. The node is published in an effect and only the column hears.

/** The track editor panel, published to the column that shows it. */
export interface EditorPanelStore {
  /** The last published panel, or null while the editor is not open. */
  readonly read: () => ReactNode;
  /** The editor box hands it over on each of its renders. */
  readonly publish: (panel: ReactNode) => void;
  /** Notifies the column; returns the unsubscribe function. */
  readonly subscribe: (listener: () => void) => () => void;
}

export function useEditorPanelStore(): EditorPanelStore {
  const panel = useRef<ReactNode>(null);
  const listeners = useRef(new Set<() => void>());
  return useMemo(
    () => ({
      read: () => panel.current,
      publish: (next: ReactNode) => {
        if (panel.current === next) return;
        panel.current = next;
        for (const listener of listeners.current) listener();
      },
      subscribe: (listener: () => void) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
    }),
    [],
  );
}

/** The published panel, re-rendering only the column that reads it. */
export function useEditorPanel(store: EditorPanelStore): ReactNode {
  return useSyncExternalStore(store.subscribe, store.read, () => null);
}

/**
 * Publishes the panel the editor hands over, without drawing anything where the editor left it.
 * It does so in an effect and not during render: its consumer is in another branch of the tree
 * and updating it mid-render of the editor would be a state change on an already rendered component.
 */
export function usePublishedPanel(store: EditorPanelStore, panel: ReactNode): void {
  useEffect(() => {
    store.publish(panel);
    return () => {
      store.publish(null);
    };
  }, [store, panel]);
}
