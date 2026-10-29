import type { FreeProgress, RemoteControl, RemoteEvent } from '@trayectoria/sims/arena';

export interface RemoteBus extends RemoteControl {
  emit: (event: RemoteEvent) => void;
  report: (progress: FreeProgress | null) => void;
  /** Hears the arena's reports; returns the way to stop. */
  watch: (listener: (progress: FreeProgress | null) => void) => () => void;
}

/** A minimal event bus between the classroom panel (transport) and the arena (consumer). */
export function createRemoteBus(): RemoteBus {
  const listeners = new Set<(event: RemoteEvent) => void>();
  const watchers = new Set<(progress: FreeProgress | null) => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    emit(event) {
      for (const listener of listeners) listener(event);
    },
    report(progress) {
      for (const watcher of watchers) watcher(progress);
    },
    watch(watcher) {
      watchers.add(watcher);
      return () => void watchers.delete(watcher);
    },
  };
}
