import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

/** The `aria-live` region is refreshed at most this often (docs/WIDGETS.md, reglas comunes). */
const LIVE_PERIOD_MS = 2000;

/** One line of the panel: term and value, already translated and formatted. */
export type ReadoutRow = readonly [term: string, value: string];

/** A panel of more rows than this folds the ones after the first `DEFAULT_VISIBLE_ROWS` (v1.5). */
const FOLD_FROM_ROWS = 7;
const DEFAULT_VISIBLE_ROWS = 5;

export interface ReadoutPanelProps {
  /** Accessible name of the panel, already translated. */
  title: string;
  rows: readonly ReadoutRow[];
  /**
   * How many leading rows stay in view; the rest sit behind «Más datos». Without it a panel
   * of 7 rows or more shows the first 5 and shorter ones show everything (v1.5).
   */
  visibleRows?: number;
}

/** The `dl` of a list of rows. */
function Rows({ rows }: { rows: readonly ReadoutRow[] }): JSX.Element {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-fg-muted text-sm">{term}</dt>
          <dd className="text-fg text-right font-mono text-sm tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Values panel of docs/DESIGN.md §5 («Panel de parámetros»): a card with a `dl` in a
 * `1fr auto` grid, muted terms and mono `tabular-nums` values aligned right.
 */
export function ReadoutPanel({ title, rows, visibleRows }: ReadoutPanelProps): JSX.Element {
  const t = useT();
  const shown = visibleRows ?? (rows.length >= FOLD_FROM_ROWS ? DEFAULT_VISIBLE_ROWS : rows.length);
  const folded = rows.slice(shown);
  return (
    <section
      className="bg-bg-raised border-border rounded-lg border p-5"
      aria-label={title}
      data-testid="readout-panel"
    >
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      <Rows rows={rows.slice(0, shown)} />
      {folded.length === 0 ? null : (
        <details className="mt-1" data-testid="readout-more">
          <summary className="text-primary min-h-11 flex cursor-pointer items-center text-sm font-medium">
            {t('widgets.ReadoutPanel.more')}
          </summary>
          <Rows rows={folded} />
        </details>
      )}
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
