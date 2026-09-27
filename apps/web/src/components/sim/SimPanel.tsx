import type { JSX, ReactNode } from 'react';

import { SimAccordion } from './SimAccordion';

// F4-02b (#128): a panel of `/simuladores/movil`; on mobile it is an accordion of the group and on
// desktop a card of the right column. It lives apart from `MobileSimPanels.tsx` since #189,
// so that the editor column can use it too without an import cycle and so that neither of the
// two files goes over the limit of docs/STANDARDS.md §4.

/** Which accordion is open on mobile; only one at a time (docs/DESIGN.md §9.4). */
export type OpenPanelId =
  | 'robot'
  | 'track'
  | 'controller'
  | 'readouts'
  | 'plots'
  | 'share'
  // #189 (decision 2): the segment panel, the only one in the column while the track is edited.
  | 'editor'
  | null;

export interface PanelProps {
  id: Exclude<OpenPanelId, null>;
  title: string;
  summary?: string;
  mobile?: boolean;
  openId: OpenPanelId;
  setOpenId: (id: OpenPanelId) => void;
  children: ReactNode;
}

/** The mobile version of a panel: an accordion of the group, with only one open at a time. */
function AccordionPanel(props: PanelProps): JSX.Element {
  const { id, title, summary, openId, setOpenId, children } = props;
  return (
    <SimAccordion
      title={title}
      {...(summary === undefined ? {} : { summary })}
      open={openId === id}
      onToggle={(open) => {
        setOpenId(open ? id : null);
      }}
    >
      {children}
    </SimAccordion>
  );
}

/** A page panel: on mobile it goes in an accordion of the group, on desktop in a card. */
export function Panel(props: PanelProps): JSX.Element {
  const { id, title, children } = props;
  if (props.mobile === true) return <AccordionPanel {...props} />;
  return (
    // `overflow-hidden`: the «Gráficas» plots fix a pixel width on the canvas that never
    // shrinks again, and without clipping here the card would grow with it (F4-03, #129).
    <section
      className="border-border bg-bg-raised min-w-0 overflow-hidden rounded-lg border p-4"
      data-testid={`panel-${id}`}
    >
      <h2 className="text-fg mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}
