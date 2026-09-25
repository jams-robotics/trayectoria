import type { JSX, ReactNode } from 'react';

/** Breakpoint from which the layout splits into two columns. */
export type SimLayoutBreakpoint = 'md' | 'lg';

/**
 * Literal class names per breakpoint, so Tailwind finds them when it scans the sources.
 * `rows` gives the second row the leftover height, so a values column taller than the viewer
 * never opens a gap between the viewer and the parameters.
 */
const CLASSES: Readonly<
  Record<
    SimLayoutBreakpoint,
    {
      root: string;
      rows: string;
      viewer: string;
      values: string;
      valuesSpan: string;
      params: string;
    }
  >
> = {
  md: {
    root: 'flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-start',
    rows: 'md:grid-rows-[auto_1fr]',
    viewer: 'flex min-w-0 flex-col gap-3 md:col-start-1 md:row-start-1',
    values: 'flex flex-col gap-4 md:col-start-2 md:row-start-1 md:w-panel',
    valuesSpan: 'md:row-span-2',
    params: 'flex min-w-0 flex-col gap-4 md:col-start-1 md:row-start-2',
  },
  lg: {
    root: 'flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start',
    rows: 'lg:grid-rows-[auto_1fr]',
    viewer: 'flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1',
    values: 'flex flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:w-panel',
    valuesSpan: 'lg:row-span-2',
    params: 'flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-2',
  },
};

/**
 * Layout of a simulator with a viewer and a panel (docs/DESIGN.md §6): on desktop the left
 * column holds the viewer, its playback controls and, under them, the parameters; the right
 * column (`w-panel`) holds only the values and their live description. Below the breakpoint the
 * DOM order applies, viewer, values and parameters, which is the single column of §9.
 */
export function SimLayout({
  viewer,
  values,
  params,
  from = 'lg',
}: {
  viewer: ReactNode;
  values: ReactNode;
  params?: ReactNode;
  from?: SimLayoutBreakpoint;
}): JSX.Element {
  const classes = CLASSES[from];
  const withParams = params !== undefined && params !== null;
  return (
    <div className={withParams ? `${classes.root} ${classes.rows}` : classes.root}>
      <div className={classes.viewer} data-sim-region="viewer">
        {viewer}
      </div>
      <div
        className={withParams ? `${classes.values} ${classes.valuesSpan}` : classes.values}
        data-sim-region="values"
      >
        {values}
      </div>
      {withParams ? (
        <div className={classes.params} data-sim-region="params">
          {params}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The A/B parameter panels: side by side while each one gets at least 280 px, one under the
 * other otherwise (docs/DESIGN.md §6).
 */
export function ParamGrid({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-start gap-4">
      {children}
    </div>
  );
}
