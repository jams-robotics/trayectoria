import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';

/** The `aria-live` region is refreshed at most this often (docs/WIDGETS.md, reglas comunes). */
const LIVE_PERIOD_MS = 2000;

/** One line of the panel: term and value, already translated and formatted. */
export type ReadoutRow = readonly [term: string, value: string];

export interface ReadoutPanelProps {
  /** Accessible name of the panel, already translated. */
  title: string;
  rows: readonly ReadoutRow[];
}

/**
 * Values panel of docs/DESIGN.md §5 («Panel de parámetros»): a card with a `dl` in a
 * `1fr auto` grid, muted terms and mono `tabular-nums` values aligned right.
 */
export function ReadoutPanel({ title, rows }: ReadoutPanelProps): JSX.Element {
  return (
    <section
      className="bg-bg-raised border-border rounded-lg border p-5"
      aria-label={title}
      data-testid="readout-panel"
    >
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-fg-muted text-sm">{term}</dt>
            <dd className="text-fg text-right font-mono text-sm tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * Textual description of the state for a screen reader, refreshed at most every two seconds
 * (docs/WIDGETS.md, reglas comunes; #86, decision 8). Dragging a tip emits a value per frame,
 * so announcing every one of them would be unusable.
 */
export function LiveStatus({ text }: { text: string }): JSX.Element {
  const [announced, setAnnounced] = useState(text);
  const lastAt_ms = useRef(0);
  useEffect(() => {
    const now_ms = performance.now();
    const wait_ms = Math.max(LIVE_PERIOD_MS - (now_ms - lastAt_ms.current), 0);
    const timer = setTimeout(() => {
      lastAt_ms.current = performance.now();
      setAnnounced(text);
    }, wait_ms);
    return () => {
      clearTimeout(timer);
    };
  }, [text]);
  return (
    <p className="sr-only" role="status" aria-live="polite">
      {announced}
    </p>
  );
}
