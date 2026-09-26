// F4-03 (#129, decision 6): the plot catalog lives apart from the widget so that
// `Instruments.tsx` uses it without importing `LineFollowerWidget.tsx`, which in turn imports the
// plots — a cycle the bundler has no reason to resolve.

/** Plots that `showPlots` can ask for (docs/WIDGETS.md, LineFollowerWidget). */
export type LineFollowerPlot = 'error' | 'v' | 'omega' | 'pid';
