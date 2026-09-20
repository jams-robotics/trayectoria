import { useMemo, useRef, useSyncExternalStore } from 'react';
import type { LiveInstruments } from '@trayectoria/sims';

// F4-03 (#129, decisión 6): el canal por el que `LineFollowerWidget` le entrega a la página los
// anillos de las gráficas y el cronómetro de vuelta, por la misma razón que `apiStore.ts` existe
// para la api: guardarlos en el estado de la isla la encadenaría consigo misma.

/** La instrumentación en curso, publicada a quien la mire sin re-renderizar la página entera. */
export interface InstrumentsStore {
  /** La última publicada, o null mientras el simulador no haya montado. */
  readonly read: () => LiveInstruments | null;
  /** La entrega el widget en cada cambio observable. */
  readonly publish: (instruments: LiveInstruments) => void;
  /** Avisa a un consumidor; devuelve la baja. */
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

/** La instrumentación en curso, re-renderizando solo al componente que la lee. */
export function useInstrumentsStore(store: InstrumentsStore): LiveInstruments | null {
  return useSyncExternalStore(store.subscribe, store.read, () => null);
}
