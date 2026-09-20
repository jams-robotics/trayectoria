import { useCallback, useState } from 'react';

// #190 (decisión 3): separado de `useMobileSimState.ts` para mantener ese archivo bajo el límite
// de docs/STANDARDS.md §4. Sigue siendo el mismo hook: qué ocupa la caja del visor y cómo se
// cambia (#158, decisiones 1 y 3).

/**
 * Qué ocupa la caja del visor: la simulación o el editor de pista (#158, decisión 1). El editor
 * sustituye al visor en la misma caja; no es un panel que se despliegue bajo la columna derecha.
 */
export type SimView = 'sim' | 'editor';

/**
 * Qué ocupa la caja del visor y cómo se cambia (#158, decisiones 1 y 3). «Volver a la simulación»
 * solo devuelve la caja al visor: la pista editada ya llegó por `onTrack` en cada cambio del
 * editor, y el reinicio a `t = 0` en pausa lo pide la isla, que es quien tiene la api del widget.
 */
export function useSimView(): {
  view: SimView;
  openEditor: () => void;
  openNewEditor: () => void;
  closeEditor: () => void;
  /** True mientras el editor abierto haya partido del lienzo vacío (#190, decisión 3). */
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
