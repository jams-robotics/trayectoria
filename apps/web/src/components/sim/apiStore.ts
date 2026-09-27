import { useMemo, useRef, useSyncExternalStore } from 'react';
import type { LineFollowerApi } from '@trayectoria/sims';

// F4-02b (#128): the channel through which `LineFollowerWidget` tells the page how the
// simulation is going, without chaining it to itself.

/**
 * The running simulation, published to whoever watches it without re-rendering the whole page.
 *
 * `LineFollowerWidget` receives `renderPanel` and publishes its api with `onApi`, so storing the
 * api in this page's state would chain it to itself: every published state re-renders the
 * page, that re-renders the widget and the widget publishes another state. With the api in a
 * `ref` and a separate subscription, the loop does not exist: the widget renders on its own and
 * only the two consumers of the api («Lecturas» and the bottom bar) hear about each tick.
 */
export interface ApiStore {
  /** The last published api, or null while the simulator has not mounted. */
  readonly read: () => LineFollowerApi | null;
  /** The widget hands it over on every observable change. */
  readonly publish: (api: LineFollowerApi) => void;
  /** Notifies a consumer; returns the unsubscribe function. */
  readonly subscribe: (listener: () => void) => () => void;
}

export function useApiStore(): ApiStore {
  const api = useRef<LineFollowerApi | null>(null);
  const listeners = useRef(new Set<() => void>());
  return useMemo(
    () => ({
      read: () => api.current,
      publish: (next) => {
        api.current = next;
        for (const listener of listeners.current) listener();
      },
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener);
      },
    }),
    [],
  );
}

/** The running api, re-rendering only the component that reads it. */
export function useApi(store: ApiStore): LineFollowerApi | null {
  return useSyncExternalStore(store.subscribe, store.read, () => null);
}

