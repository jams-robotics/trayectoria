import { useMemo, useRef, useSyncExternalStore } from 'react';
import type { LiveInstruments } from '@trayectoria/sims';

// F4-03 (#129, decision 6): the channel through which `LineFollowerWidget` hands the page the
// plot rings and the lap timer, for the same reason `apiStore.ts` exists for the api: storing
// them in the island's state would chain it to itself.

/** The running instrumentation, published to whoever watches it without re-rendering the page. */
export interface InstrumentsStore {
  /** The last one published, or null while the simulator has not mounted. */
  readonly read: () => LiveInstruments | null;
  /** The widget hands it over on every observable change. */
  readonly publish: (instruments: LiveInstruments) => void;
  /** Notifies a consumer; returns the unsubscribe function. */
  readonly subscribe: (listener: () => void) => () => void;
}

export function useInstruments(): InstrumentsStore {
  const current = useRef<LiveInstruments | null>(null);
  const listeners = useRef(new Set<() => void>());
  return useMemo(
    () => ({
      read: () => current.current,
      publish: (next) => {
        current.current = next;
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

/** The running instrumentation, re-rendering only the component that reads it. */
export function useInstrumentsStore(store: InstrumentsStore): LiveInstruments | null {
  return useSyncExternalStore(store.subscribe, store.read, () => null);
}
