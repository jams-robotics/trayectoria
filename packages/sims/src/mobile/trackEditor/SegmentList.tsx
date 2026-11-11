import { useId } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import { segmentLength_m } from '@trayectoria/sim-core';
import type { TrackSegment } from '@trayectoria/sim-core';

import { ContinuityNotice } from './notices';
import type { ContinuityReport } from './continuity';

// #552: the segments block of the numeric panel — the list and, under it, the continuity notice.
// It lives apart from `SegmentPanel.tsx` so that file stays under the 300 lines of
// docs/STANDARDS.md §4.

// A selectable list, not a stack of fields (#552): no field border, `min-h-[44px]` rows
// (docs/DESIGN.md §9.3; `min-h-11` is 80 px on the D-01 scale) and the selected row with the
// `primary` background of docs/DESIGN.md §5 (Tabs/segmentado). `aria-pressed` says which one
// it is without relying on colour (§8).
const ROW =
  'text-fg-muted focus-visible:outline-focus hover:bg-bg hover:text-fg flex min-h-[44px] w-full cursor-pointer items-center rounded-sm px-3 text-left font-mono text-xs focus-visible:outline-2 focus-visible:outline-offset-2';
const ROW_ON = 'bg-primary text-primary-fg hover:bg-primary hover:text-primary-fg';

export interface SegmentListProps {
  segments: readonly TrackSegment[];
  selected: number | null;
  onSelect: (index: number) => void;
  /** The continuity of the whole track, shown under the list it describes (#552). */
  continuity: ContinuityReport;
}

/** Decimals of the lengths shown in the list, in metres. */
const LENGTH_DECIMALS = 2;

/** «1.20 m» for a straight segment, «radio 0.40 m» for an arc. */
function measureOf(segment: TrackSegment, t: ReturnType<typeof useT>): string {
  return segment.type === 'arc'
    ? t('sims.trackEditor.measureArc', { radius: segment.radius_m.toFixed(LENGTH_DECIMALS) })
    : t('sims.trackEditor.measureLine', { length: segmentLength_m(segment).toFixed(LENGTH_DECIMALS) });
}

/** The rows of the list: the keyboard way into the selection, with no pointer involved. */
function Rows({
  segments,
  selected,
  onSelect,
}: Pick<SegmentListProps, 'segments' | 'selected' | 'onSelect'>): JSX.Element {
  const t = useT();
  const id = useId();
  if (segments.length === 0) {
    return <p className="text-fg-muted text-sm">{t('sims.trackEditor.noSegments')}</p>;
  }
  return (
    <ul className="flex flex-col gap-1" aria-label={t('sims.trackEditor.segments')}>
      {segments.map((segment, index) => (
        <li key={`${segment.type}-${String(index)}`}>
          <button
            type="button"
            aria-pressed={selected === index}
            // #160: mark of the selected segment, the same one the canvas highlights.
            {...(selected === index ? { 'data-selected': 'true' } : {})}
            aria-label={t(`sims.trackEditor.segment${segment.type === 'arc' ? 'Arc' : 'Line'}`, {
              index: index + 1,
            })}
            aria-describedby={`${id}-${String(index)}`}
            onClick={() => {
              onSelect(index);
            }}
            className={`${ROW} ${selected === index ? ROW_ON : ''} justify-between gap-3`}
          >
            {t(`sims.trackEditor.segment${segment.type === 'arc' ? 'Arc' : 'Line'}`, {
              index: index + 1,
            })}
            <span id={`${id}-${String(index)}`}>{measureOf(segment, t)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The segments block: the selectable list and the continuity notice that belongs with it. */
export function SegmentList({
  segments,
  selected,
  onSelect,
  continuity,
}: SegmentListProps): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-col gap-3" data-testid="track-editor-segments">
      <Rows segments={segments} selected={selected} onSelect={onSelect} />
      {segments.length === 0 ? null : (
        <p className="text-fg-muted text-sm" data-testid="track-editor-total">
          {t('sims.trackEditor.totalLength', {
            length: segments.reduce((sum, s) => sum + segmentLength_m(s), 0).toFixed(LENGTH_DECIMALS),
          })}
        </p>
      )}
      <ContinuityNotice report={continuity} />
    </div>
  );
}
