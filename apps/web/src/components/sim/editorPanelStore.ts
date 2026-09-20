import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

// #189 (decisiones 1 y 2): el canal por el que el panel numérico del editor de pista llega desde
// la caja del visor —donde `TrackEditor` lo entrega por `renderPanel`— hasta la columna derecha de
// la página, que es donde la decisión 2 lo coloca.
//
// Es el mismo patrón que `apiStore` y `instrumentsStore`: la caja y la columna son hermanas dentro
// del árbol del widget (una llega por `renderViewer` y la otra por `renderPanel`), así que no hay
// padre común que pueda pasarles el nodo por props sin volver a renderizar la página entera en
// cada cambio del editor. El nodo se publica en un efecto y solo la columna se entera.

/** El panel del editor de pista, publicado a la columna que lo muestra. */
export interface EditorPanelStore {
  /** El último panel publicado, o null mientras el editor no esté abierto. */
  readonly read: () => ReactNode;
  /** Lo entrega la caja del editor en cada render suyo. */
  readonly publish: (panel: ReactNode) => void;
  /** Avisa a la columna; devuelve la baja. */
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

/** El panel publicado, re-renderizando solo a la columna que lo lee. */
export function useEditorPanel(store: EditorPanelStore): ReactNode {
  return useSyncExternalStore(store.subscribe, store.read, () => null);
}

/**
 * Publica el panel que el editor entrega, sin pintar nada donde el editor lo dejó. Lo hace en un
 * efecto y no durante el render: quien lo consume está en otra rama del árbol y actualizarla en
 * mitad del render del editor sería un cambio de estado sobre un componente ya renderizado.
 */
export function usePublishedPanel(store: EditorPanelStore, panel: ReactNode): void {
  useEffect(() => {
    store.publish(panel);
    return () => {
      store.publish(null);
    };
  }, [store, panel]);
}
