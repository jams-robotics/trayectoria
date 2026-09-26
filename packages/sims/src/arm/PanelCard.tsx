import type { JSX, ReactNode } from 'react';

// #383 (docs/DESIGN.md §5, Tarjeta): the title of a side panel of the arm viewer and, under it,
// its content in a card, the same way the joint sliders already show (title, then the card of
// `ParamPanel`).

/** Card classes: `bg-raised` over the page background, `border` and radius `lg`. */
const CARD = 'border-border bg-bg-raised mt-3 flex flex-col rounded-lg border p-6';

/** A side panel's title and its content in a card. */
export function PanelCard({
  title,
  testId,
  gapClass,
  children,
}: {
  title: string;
  testId: string;
  /** Gap between the card's children (literal class, so Tailwind sees it). */
  gapClass: 'gap-1' | 'gap-3';
  children: ReactNode;
}): JSX.Element {
  return (
    <>
      <h3 className="text-fg-muted font-mono text-xs tracking-[0.06em] uppercase">{title}</h3>
      <div className={`${CARD} ${gapClass}`} data-testid={testId}>
        {children}
      </div>
    </>
  );
}
