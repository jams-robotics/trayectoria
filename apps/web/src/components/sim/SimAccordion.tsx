import { useId, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';

// F5-01b (#134, decision 3): minimal accordion for the simulator panels on mobile
// (docs/DESIGN.md §9 points 3, 4 and 8: 48–52 px header, summary readable with the panel
// closed and the «ver ▾ / ocultar ▴» control with text besides the glyph). F4-02b will reuse this
// component for the mobile simulator panels; that is why it lives in `components/sim/` and not
// next to the arm island.

/** Glyphs of the open control; they always come with the text of the action. */
const CHEVRON_OPEN = '▴';
const CHEVRON_CLOSED = '▾';

export interface SimAccordionProps {
  /** Header title. */
  title: string;
  /** Inline summary, readable with the accordion closed. */
  summary?: string;
  /** Whether the accordion starts open. Ignored if the accordion is controlled with `open`. */
  defaultOpen?: boolean;
  /**
   * State controlled from outside. The arm page group uses it to keep only one
   * accordion open at a time (docs/DESIGN.md §9.4); without it the accordion governs itself.
   */
  open?: boolean;
  /** Called with the state the accordion moves to when the header is pressed. */
  onToggle?: (open: boolean) => void;
  children: ReactNode;
}

/** Collapsible panel with a touch-target header and a summary readable when closed. */
export function SimAccordion({
  title,
  summary,
  defaultOpen = false,
  open: controlledOpen,
  onToggle,
  children,
}: SimAccordionProps): JSX.Element {
  const t = useT();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const panelId = useId();

  return (
    <section className="border-border bg-bg-raised rounded-lg border" data-testid="sim-accordion">
      <h3>
        <button
          type="button"
          className="flex min-h-[48px] w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setUncontrolledOpen(!open);
            onToggle?.(!open);
          }}
        >
          <span className="text-fg flex-1 font-semibold">{title}</span>
          {summary === undefined ? null : (
            <span className="text-fg-muted truncate font-mono text-xs">{summary}</span>
          )}
          <span className="text-fg-muted text-sm whitespace-nowrap">
            {open ? `${t('sims.armPage.collapse')} ${CHEVRON_OPEN}` : `${t('sims.armPage.expand')} ${CHEVRON_CLOSED}`}
          </span>
        </button>
      </h3>
      <div id={panelId} hidden={!open} className="px-4 pt-1 pb-4">
        {children}
      </div>
    </section>
  );
}
