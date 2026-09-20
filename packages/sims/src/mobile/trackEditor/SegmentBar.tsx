import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { TrackSegment } from '@trayectoria/sim-core';

import { useDraft } from './SegmentPanel';

// docs/DESIGN.md §5 and §8: 44 px targets, tokens only, focus ring of 2 px always visible.
const BAR =
  'border-border bg-bg-raised rounded-md pointer-events-auto flex items-center gap-2 border p-2 shadow-md';
const BUTTON =
  'border-border bg-bg text-fg rounded-sm focus-visible:outline-focus min-h-11 cursor-pointer border px-3 text-sm font-semibold hover:border-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2';
const FIELD =
  'border-border bg-bg text-fg rounded-sm focus-visible:outline-focus h-11 w-20 border px-2 text-right font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2';

/**
 * The compact radius field of the bar. It shares `useDraft` with the numeric panel, so it holds
 * the same limits (a number; `setRadius` of the model clamps a radius shorter than half the
 * chord) and applies on Enter or on blur exactly as the panel's own field does.
 */
function RadiusField({
  radius_m,
  onRadius,
}: {
  radius_m: number;
  onRadius: (radius_m: number) => void;
}): JSX.Element {
  const t = useT();
  const { draft, setDraft, commit, onKeyDown } = useDraft(radius_m, onRadius);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={t('sims.trackEditor.field.radius')}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={FIELD}
    />
  );
}

/** «Invertir sentido» plus the compact radius field: the two edits only an arc offers. */
function ArcActions({
  radius_m,
  onFlip,
  onRadius,
}: {
  radius_m: number;
  onFlip: () => void;
  onRadius: (radius_m: number) => void;
}): JSX.Element {
  const t = useT();
  return (
    <>
      <button
        type="button"
        aria-label={t('sims.trackEditor.flipArc')}
        onClick={onFlip}
        className={BUTTON}
      >
        {t('sims.trackEditor.flipArc')}
      </button>
      <RadiusField radius_m={radius_m} onRadius={onRadius} />
    </>
  );
}

export interface SegmentBarProps {
  /** The selected segment; the bar is not rendered without one (#159, decision 1). */
  segment: TrackSegment;
  onFlip: () => void;
  onRadius: (radius_m: number) => void;
  onDelete: () => void;
}

/**
 * Floating bar over the canvas, top-right corner, shown only while a segment is selected
 * (#159, decision 1). It carries the two edits a learner reaches for right after drawing an arc
 * — invert its sweep and correct its radius — plus «Borrar», so none of them needs a trip down
 * to the numeric panel. Every control is labelled and 44 px tall (docs/DESIGN.md §8 and §9.3).
 */
export function SegmentBar({ segment, onFlip, onRadius, onDelete }: SegmentBarProps): JSX.Element {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t('sims.trackEditor.segmentBar')}
      data-testid="track-editor-segment-bar"
      className={BAR}
    >
      {segment.type === 'arc' ? (
        <ArcActions radius_m={segment.radius_m} onFlip={onFlip} onRadius={onRadius} />
      ) : null}
      <button
        type="button"
        aria-label={t('sims.trackEditor.deleteSegment')}
        onClick={onDelete}
        className={BUTTON}
      >
        {t('sims.trackEditor.deleteSegment')}
      </button>
    </div>
  );
}
