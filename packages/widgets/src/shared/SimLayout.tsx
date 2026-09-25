import type { JSX, ReactNode } from 'react';

/** Breakpoint from which the layout splits into two columns. */
export type SimLayoutBreakpoint = 'md' | 'lg';

/** Class names of one breakpoint; see `CLASSES`. */
interface LayoutClasses {
  root: string;
  rows: string;
  rowsAfter: string;
  viewer: string;
  viewerAfter: string;
  values: string;
  valuesSpan: string;
  valuesSpanAfter: string;
  params: string;
  after: string;
  mobileTail: string;
}

/**
 * Literal class names per breakpoint, so Tailwind finds them when it scans the sources.
 * The last row takes the leftover height, so a values column taller than the left column
 * never opens a gap between its blocks. With `after`, below the breakpoint the viewer region
 * dissolves (`contents`) and the orders put `after` right behind the viewer's first child,
 * which is where it sat in the single mobile column before the §6 layout.
 */
const CLASSES: Readonly<Record<SimLayoutBreakpoint, LayoutClasses>> = {
  md: {
    root: 'flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-start',
    rows: 'md:grid-rows-[auto_1fr]',
    rowsAfter: 'md:grid-rows-[auto_auto_1fr]',
    viewer: 'flex min-w-0 flex-col gap-3 md:col-start-1 md:row-start-1',
    viewerAfter: 'max-md:contents max-md:[&>*:not(:first-child)]:order-2',
    values: 'flex flex-col gap-4 md:col-start-2 md:row-start-1 md:w-panel',
    valuesSpan: 'md:row-span-2',
    valuesSpanAfter: 'md:row-span-3',
    params: 'flex min-w-0 flex-col gap-4 md:col-start-1 md:row-start-2',
    after: 'flex min-w-0 flex-col gap-3 max-md:order-1 md:col-start-1 md:row-start-3',
    mobileTail: 'max-md:order-3',
  },
  lg: {
    root: 'flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start',
    rows: 'lg:grid-rows-[auto_1fr]',
    rowsAfter: 'lg:grid-rows-[auto_auto_1fr]',
    viewer: 'flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1',
    viewerAfter: 'max-lg:contents max-lg:[&>*:not(:first-child)]:order-2',
    values: 'flex flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:w-panel',
    valuesSpan: 'lg:row-span-2',
    valuesSpanAfter: 'lg:row-span-3',
    params: 'flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-2',
    after: 'flex min-w-0 flex-col gap-3 max-lg:order-1 lg:col-start-1 lg:row-start-3',
    mobileTail: 'max-lg:order-3',
  },
};

/** Joins the class names that apply, skipping the empty ones. */
function cx(...names: ReadonlyArray<string | false>): string {
  return names.filter((name) => name !== false && name !== '').join(' ');
}

/** Whether a region was given something to render. */
function present(node: ReactNode): boolean {
  return node !== undefined && node !== null;
}

/** The class names of each region, given which optional regions are rendered. */
function regionClasses(
  c: LayoutClasses,
  withParams: boolean,
  withAfter: boolean,
): Pick<LayoutClasses, 'root' | 'viewer' | 'values' | 'params' | 'after'> {
  const tail = withAfter && c.mobileTail;
  return {
    root: cx(c.root, withAfter ? c.rowsAfter : withParams && c.rows),
    viewer: cx(c.viewer, withAfter && c.viewerAfter),
    values: cx(c.values, withAfter ? c.valuesSpanAfter : withParams && c.valuesSpan, tail),
    params: cx(c.params, tail),
    after: c.after,
  };
}

/**
 * Layout of a simulator with a viewer and a panel (docs/DESIGN.md §6): on desktop the left
 * column holds the viewer, its playback controls and, under them, the parameters; the right
 * column (`w-panel`) holds only the values and their live description. Below the breakpoint the
 * DOM order applies, viewer, values and parameters, which is the single column of §9.
 *
 * `after` is content of the left column that goes under the parameters on desktop, such as
 * the charts of KinematicsWidget (QA of #365); on mobile it stays right after the viewer's
 * first child.
 */
export function SimLayout({
  viewer,
  values,
  params,
  after,
  from = 'lg',
}: {
  viewer: ReactNode;
  values: ReactNode;
  params?: ReactNode;
  after?: ReactNode;
  from?: SimLayoutBreakpoint;
}): JSX.Element {
  const c = regionClasses(CLASSES[from], present(params), present(after));
  return (
    <div className={c.root}>
      <div className={c.viewer} data-sim-region="viewer">
        {viewer}
      </div>
      <div className={c.values} data-sim-region="values">
        {values}
      </div>
      {present(params) ? (
        <div className={c.params} data-sim-region="params">
          {params}
        </div>
      ) : null}
      {present(after) ? (
        <div className={c.after} data-sim-region="after">
          {after}
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
