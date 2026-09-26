import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { TrackSegment } from '@trayectoria/sim-core';

import { useDraft } from './SegmentPanel';

// docs/DESIGN.md §5 and §8: 44 px targets, tokens only, focus ring of 2 px always visible.
// #189 (decision 4): the bar switches to a compact format. Over a ~600 px canvas the version with
// the full labels measured ≈ 376 px and covered almost everything drawn; with labelled icons and a
// four-digit radius field the widest case —an arc, with the three controls— measures
// 4+40+4+48+4+40+4 = 144 px plus the 2 px of the border, below the 160 px target.
const BAR =
  'border-border bg-bg-raised rounded-md pointer-events-auto flex items-center gap-1 border p-1 shadow-md';
// 40×40 px icon button, the minimum of docs/DESIGN.md §5 for a bar control. The glyph is
// decorative (`aria-hidden`) and what names it is its `aria-label`; `title` gives the same text with the
// pointer over it (#189, decision 4).
const BUTTON =
  'border-border bg-bg text-fg rounded-sm focus-visible:outline-focus h-8 w-8 shrink-0 cursor-pointer border text-sm leading-none font-semibold hover:border-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2';
// Four-digit radius field in metres («0.125»). The widths come from the D-01 token
// scale, the only one global.css exposes (#167): `w-9` is 48 px and `h-8` 40 px, and the mono `xs` is the
// minimum size docs/DESIGN.md §9.2 allows for figures with a unit.
const FIELD =
  'border-border bg-bg text-fg rounded-sm focus-visible:outline-focus h-8 w-9 shrink-0 border px-1 text-right font-mono text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2';

/** Glyph of «Invertir sentido»: two arrows turning around. Decorative; the button names it. */
const FLIP_GLYPH = '⇄';

/** Glyph of «Borrar segmento». Decorative; the button names it. */
const DELETE_GLYPH = '✕';

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
  const label = t('sims.trackEditor.field.radius');
  const { draft, setDraft, commit, onKeyDown } = useDraft(radius_m, onRadius);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      title={label}
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

/** An icon button of the bar: the glyph draws it, the `aria-label` and the `title` name it. */
function IconButton({
  label,
  glyph,
  onClick,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={BUTTON}>
      <span aria-hidden="true">{glyph}</span>
    </button>
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
      <IconButton label={t('sims.trackEditor.flipArc')} glyph={FLIP_GLYPH} onClick={onFlip} />
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
 * to the numeric panel. Every control is labelled and 40 px tall, the minimum of docs/DESIGN.md §5
 * for a bar control: the bar lives over the canvas and whatever extra size it has is taken away
 * from what is drawn (#189, decision 4).
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
      <IconButton
        label={t('sims.trackEditor.deleteSegment')}
        glyph={DELETE_GLYPH}
        onClick={onDelete}
      />
    </div>
  );
}
