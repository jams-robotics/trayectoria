import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { JSX, ReactNode, RefObject } from 'react';

import type { ArmViewerPanel } from './armPanels';

// #375 (docs/DESIGN.md, "Páginas de simulador"): the two columns of the full ArmViewer. From
// `md` on, the left column holds the scene and, under it, the matrices panel, and it stays
// sticky while the right column scrolls. Below `md` nothing changes: the matrices panel stays
// in the panel column, after the joints and the effector.
//
// The matrices panel moves in the DOM, not only on screen, so reading and focus order follow
// what is shown. Which layout is active is read from CSS (a sentinel shown only from `md`), so
// the breakpoint stays in one place and this package does not touch `window`.

/** Only from `md` and with a window at least 640 px tall (literal classes, for Tailwind). */
const LEFT_COLUMN =
  'flex min-w-0 flex-col gap-5 md:flex-1 ' +
  '[@media(min-width:768px)_and_(min-height:640px)]:sticky ' +
  '[@media(min-width:768px)_and_(min-height:640px)]:top-0 ' +
  '[@media(min-width:768px)_and_(min-height:640px)]:max-h-screen ' +
  '[@media(min-width:768px)_and_(min-height:640px)]:overflow-y-auto';

/** Caps the 16/9 scene at 50 vh (so 50vh·16/9 wide) and centres it, same conditions. */
const SCENE_CAP =
  'min-w-0 [@media(min-width:768px)_and_(min-height:640px)]:mx-auto ' +
  '[@media(min-width:768px)_and_(min-height:640px)]:w-full ' +
  '[@media(min-width:768px)_and_(min-height:640px)]:max-w-[calc(50vh*16/9)]';

/** Whether the row is split in two columns: the sentinel is displayed only from `md`. */
function useSplit(
  row: RefObject<HTMLDivElement | null>,
  sentinel: RefObject<HTMLSpanElement | null>,
): boolean {
  const [split, setSplit] = useState(false);
  useLayoutEffect(() => {
    const element = row.current;
    const probe = sentinel.current;
    if (element === null || probe === null) return undefined;
    const update = (): void => {
      setSplit(probe.getClientRects().length > 0);
    };
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [row, sentinel]);
  return split;
}

/** The full (non-compact) viewer: sticky scene and matrices on the left, the rest on the right. */
export function ArmColumns({
  scene,
  panels,
  renderPanel,
}: {
  scene: ReactNode;
  panels: readonly ArmViewerPanel[];
  renderPanel: ((panel: ArmViewerPanel) => ReactNode) | undefined;
}): JSX.Element {
  const row = useRef<HTMLDivElement | null>(null);
  const sentinel = useRef<HTMLSpanElement | null>(null);
  const split = useSplit(row, sentinel);
  // `renderPanel` is still called once per panel and in order (armPanels.tsx contract); only
  // where each result lands changes.
  const rendered = panels.map((panel) => ({
    id: panel.id,
    node: (
      <Fragment key={panel.id}>
        {renderPanel === undefined ? panel.content : renderPanel(panel)}
      </Fragment>
    ),
  }));
  const left = split ? rendered.filter((slot) => slot.id === 'matrices') : [];
  const right = split ? rendered.filter((slot) => slot.id !== 'matrices') : rendered;
  return (
    <div
      ref={row}
      className="flex flex-col gap-5 md:flex-row md:items-start"
      data-testid="arm-viewer"
      data-compact="false"
      data-split={String(split)}
    >
      <span ref={sentinel} className="hidden md:block" aria-hidden="true" />
      <div className={LEFT_COLUMN} data-testid="arm-viewer-left">
        <div className={SCENE_CAP}>{scene}</div>
        {left.map((slot) => slot.node)}
      </div>
      <div className="flex min-w-0 flex-col gap-5 md:w-panel">{right.map((slot) => slot.node)}</div>
    </div>
  );
}
