import type { JSX, ReactNode } from 'react';

/** Breakpoint from which the layout splits into two columns. */
export type SimLayoutBreakpoint = 'md' | 'lg';

/**
 * Where an extra block sits in the single mobile column, which keeps the order it had before
 * the §6 layout: right after the viewer's first child, after the whole viewer, or at the end.
 */
export type SimExtraAnchor = 'afterViewerFirst' | 'afterViewer' | 'end';

/** A chart or secondary panel, below the controls and full width on desktop (§6, point 3). */
export interface SimExtra {
  key: string;
  node: ReactNode;
  mobile: SimExtraAnchor;
}

/** Class names of one breakpoint; see `CLASSES`. */
interface LayoutClasses {
  top: string;
  viewer: string;
  viewerSplit: string;
  values: string;
  valuesScroll: string;
  params: string;
  extras: string;
  anchor: Readonly<Record<SimExtraAnchor, string>>;
}

/**
 * Literal class names per breakpoint, so Tailwind finds them when it scans the sources.
 *
 * From the breakpoint the top row (viewer, playback and values) is sticky while the window is
 * at least 640 px high; the values scroll inside a box as tall as the viewer column, so they
 * never set the height of the row. The parameters form a 2 column grid: an A/B `ParamGrid`
 * dissolves into it, and a lone panel with 4 or more sliders spans both columns and lays its
 * sliders out in 2 columns. Focusable controls below the row keep a scroll margin so the
 * keyboard focus is not hidden under it (§8).
 *
 * Below the breakpoint every wrapper dissolves (`contents`) and the orders rebuild the single
 * column of §9: viewer, values, parameters, with each extra block at its `SimExtraAnchor`.
 * An extra right after the viewer pulls up 4 px to keep the 12 px gap it had inside it.
 */
const CLASSES: Readonly<Record<SimLayoutBreakpoint, LayoutClasses>> = {
  md: {
    top: 'max-md:contents md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-4 md:[@media(min-height:640px)]:sticky md:[@media(min-height:640px)]:top-0 md:[@media(min-height:640px)]:z-10 md:[@media(min-height:640px)]:bg-bg md:[@media(min-height:640px)]:pb-3',
    viewer: 'flex min-w-0 flex-col gap-3 md:mx-auto md:w-full md:max-w-[calc(50vh*16/9)]',
    viewerSplit: 'max-md:contents max-md:[&>*:not(:first-child)]:order-2',
    values: 'max-md:order-4 md:relative md:w-panel',
    valuesScroll: 'flex flex-col gap-4 md:absolute md:inset-0 md:overflow-y-auto',
    params:
      'flex min-w-0 flex-col gap-4 max-md:order-5 md:grid md:grid-cols-2 md:items-start md:[&>[data-param-grid]]:contents md:[&>[data-layout=stack]:only-child:has(>div>:nth-child(4))]:col-span-2 md:[&>:only-child:not([data-param-grid]):has([data-layout=stack]>div>:nth-child(4))]:col-span-2 md:[&:has(>:only-child:not([data-param-grid]))_[data-layout=stack]>div:has(>:nth-child(4))]:grid md:[&:has(>:only-child:not([data-param-grid]))_[data-layout=stack]>div:has(>:nth-child(4))]:grid-cols-2 md:[@media(min-height:640px)]:[&_:is(input,select,button)]:scroll-mt-[calc(50vh+64px)]',
    extras:
      'flex min-w-0 flex-col gap-4 max-md:contents md:[@media(min-height:640px)]:[&_:is(input,select,button)]:scroll-mt-[calc(50vh+64px)]',
    anchor: {
      afterViewerFirst: 'max-md:order-1',
      afterViewer: 'max-md:order-3 max-md:-mt-1',
      end: 'max-md:order-6',
    },
  },
  lg: {
    top: 'max-lg:contents lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-4 lg:[@media(min-height:640px)]:sticky lg:[@media(min-height:640px)]:top-0 lg:[@media(min-height:640px)]:z-10 lg:[@media(min-height:640px)]:bg-bg lg:[@media(min-height:640px)]:pb-3',
    viewer: 'flex min-w-0 flex-col gap-3 lg:mx-auto lg:w-full lg:max-w-[calc(50vh*16/9)]',
    viewerSplit: 'max-lg:contents max-lg:[&>*:not(:first-child)]:order-2',
    values: 'max-lg:order-4 lg:relative lg:w-panel',
    valuesScroll: 'flex flex-col gap-4 lg:absolute lg:inset-0 lg:overflow-y-auto',
    params:
      'flex min-w-0 flex-col gap-4 max-lg:order-5 lg:grid lg:grid-cols-2 lg:items-start lg:[&>[data-param-grid]]:contents lg:[&>[data-layout=stack]:only-child:has(>div>:nth-child(4))]:col-span-2 lg:[&>:only-child:not([data-param-grid]):has([data-layout=stack]>div>:nth-child(4))]:col-span-2 lg:[&:has(>:only-child:not([data-param-grid]))_[data-layout=stack]>div:has(>:nth-child(4))]:grid lg:[&:has(>:only-child:not([data-param-grid]))_[data-layout=stack]>div:has(>:nth-child(4))]:grid-cols-2 lg:[@media(min-height:640px)]:[&_:is(input,select,button)]:scroll-mt-[calc(50vh+64px)]',
    extras:
      'flex min-w-0 flex-col gap-4 max-lg:contents lg:[@media(min-height:640px)]:[&_:is(input,select,button)]:scroll-mt-[calc(50vh+64px)]',
    anchor: {
      afterViewerFirst: 'max-lg:order-1',
      afterViewer: 'max-lg:order-3 max-lg:-mt-1',
      end: 'max-lg:order-6',
    },
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

/** The extras, full width on desktop and each one at its anchor on mobile. */
function Extras({ extras, c }: { extras: readonly SimExtra[]; c: LayoutClasses }): JSX.Element {
  return (
    <div className={c.extras} data-sim-region="extras">
      {extras.map((extra) => (
        <div key={extra.key} className={cx('min-w-0', c.anchor[extra.mobile])}>
          {extra.node}
        </div>
      ))}
    </div>
  );
}

/**
 * Layout of a simulator with a viewer and a panel (docs/DESIGN.md §6): on desktop a sticky top
 * row with the viewer and its playback controls on the left and only the values and their live
 * description on the right (`w-panel`); under it, full width, the parameters in 2 columns and
 * then the `extras` (charts, secondary panels). Below the breakpoint it is the single column of
 * §9 with no sticky row.
 */
export function SimLayout({
  viewer,
  values,
  params,
  extras = [],
  from = 'lg',
}: {
  viewer: ReactNode;
  values: ReactNode;
  params?: ReactNode;
  extras?: readonly SimExtra[];
  from?: SimLayoutBreakpoint;
}): JSX.Element {
  const c = CLASSES[from];
  const split = extras.some((extra) => extra.mobile === 'afterViewerFirst');
  return (
    <div className="flex flex-col gap-4">
      <div className={c.top} data-sim-row="top">
        <div className={cx(c.viewer, split && c.viewerSplit)} data-sim-region="viewer">
          {viewer}
        </div>
        <div className={c.values} data-sim-region="values">
          <div className={c.valuesScroll}>{values}</div>
        </div>
      </div>
      {present(params) ? (
        <div className={c.params} data-sim-region="params">
          {params}
        </div>
      ) : null}
      {extras.length === 0 ? null : <Extras extras={extras} c={c} />}
    </div>
  );
}

/**
 * The A/B parameter panels: below the breakpoint side by side while each one gets at least
 * 280 px, one under the other otherwise; from it they dissolve into the 2 columns of the
 * parameters of `SimLayout`, A on the left and B on the right (docs/DESIGN.md §6).
 */
export function ParamGrid({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div
      className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-start gap-4"
      data-param-grid=""
    >
      {children}
    </div>
  );
}
