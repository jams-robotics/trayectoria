import { useMemo, useRef, useSyncExternalStore } from 'react';
import type { LineFollowerApi } from '@trayectoria/sims';

// F4-02b (#128): el canal por el que `LineFollowerWidget` le cuenta a la página cómo va la
// simulación, sin encadenarla consigo misma.

/**
 * La simulación en curso, publicada a quien la mire sin volver a renderizar la página entera.
 *
 * `LineFollowerWidget` recibe `renderPanel` y publica su api con `onApi`, así que guardar la api
 * en el estado de esta página la encadenaría consigo misma: cada estado publicado re-renderiza la
 * página, eso re-renderiza el widget y el widget publica otro estado. Con la api en un `ref` y
 * una suscripción aparte, el bucle no existe: el widget se renderiza por su cuenta y solo los dos
 * consumidores de la api («Lecturas» y la barra inferior) se enteran de cada tick.
 */
export interface ApiStore {
  /** La última api publicada, o null mientras el simulador no haya montado. */
  readonly read: () => LineFollowerApi | null;
  /** La entrega el widget en cada cambio observable. */
  readonly publish: (api: LineFollowerApi) => void;
  /** Avisa a un consumidor; devuelve la baja. */
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

/** La api en curso, re-renderizando solo al componente que la lee. */
export function useApi(store: ApiStore): LineFollowerApi | null {
  return useSyncExternalStore(store.subscribe, store.read, () => null);
}

