import type { RemoteControl, RemoteEvent } from '@trayectoria/sims/arena';

export interface RemoteBus extends RemoteControl {
  emit: (event: RemoteEvent) => void;
}

/** A minimal event bus between the classroom panel (transport) and the arena (consumer). */
export function createRemoteBus(): RemoteBus {
  const listeners = new Set<(event: RemoteEvent) => void>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    emit(event) {
      for (const listener of listeners) listener(event);
    },
  };
}
