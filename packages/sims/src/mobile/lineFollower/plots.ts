// F4-03 (#129, decisión 6): el catálogo de gráficas vive aparte del widget para que
// `Instruments.tsx` lo use sin importar `LineFollowerWidget.tsx`, que a su vez importa las
// gráficas — un ciclo que el empaquetado no tiene por qué resolver.

/** Gráficas que `showPlots` puede pedir (docs/WIDGETS.md, LineFollowerWidget). */
export type LineFollowerPlot = 'error' | 'v' | 'omega' | 'pid';
