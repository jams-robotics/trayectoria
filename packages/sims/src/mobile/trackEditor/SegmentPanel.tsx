import { useEffect, useRef, useState } from 'react';
import type { JSX, KeyboardEvent } from 'react';
import { useT } from '@trayectoria/i18n';
import type { ArcSegment, TrackSegment, Vec2 } from '@trayectoria/sim-core';

import { segmentEndpoints } from './model';
import type { Endpoint } from './model';

/** Enough decimals to absorb float noise without showing it (same as ParamPanel of F2-01a). */
const MAX_DECIMALS = 6;

// docs/DESIGN.md §5 (Campo numérico) and §8: mono, tabular numbers, 40 px tall, visible focus.
// `w-12` y no `w-24`: la escala de espaciado solo expone los tokens D-01 (global.css vacía las
// escalas por defecto), así que `w-24` nunca se generaba y el campo se estiraba hasta aplastar su
// etiqueta en la columna de 280 px. Se veía solo desde que Tailwind escanea `sims` (#167).
const FIELD =
  'border-border bg-bg text-fg rounded-sm focus-visible:outline-focus h-10 w-12 border px-2 text-right font-mono text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2';
const ROW = 'text-fg-muted flex items-center justify-between gap-3 text-sm';
const SEGMENT_BUTTON =
  'border-border text-fg-muted focus-visible:outline-focus min-h-11 w-full cursor-pointer rounded-sm border px-3 text-left font-mono text-xs focus-visible:outline-2 focus-visible:outline-offset-2';
const SEGMENT_ON = 'border-primary text-fg';
// docs/DESIGN.md §5 (Tabs/segmentado): el mismo patrón que el selector de herramienta.
const DIRECTION =
  'min-h-11 border-border text-fg-muted focus-visible:outline-focus flex-1 cursor-pointer border-r px-3 text-sm font-semibold last:border-r-0 focus-visible:outline-2 focus-visible:outline-offset-2';
const DIRECTION_ON = 'bg-primary text-primary-fg';

/** Formats a number for a field: no trailing zeros, no floating point noise. */
function format(value: number): string {
  return String(Number(value.toFixed(MAX_DECIMALS)));
}

interface NumberFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}

/**
 * Draft, commit and key handling of one numeric field; kept out of the component itself. Exported
 * within the package so the compact radius field of the floating bar behaves identically (#159).
 */
export function useDraft(
  value: number,
  onCommit: (value: number) => void,
): {
  draft: string;
  setDraft: (draft: string) => void;
  commit: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
} {
  const [draft, setDraft] = useState(() => format(value));
  const shown = useRef(value);
  useEffect(() => {
    if (shown.current !== value) {
      shown.current = value;
      setDraft(format(value));
    }
  }, [value]);
  const commit = (): void => {
    const parsed = Number(draft);
    if (draft.trim() === '' || Number.isNaN(parsed)) {
      setDraft(format(value));
      return;
    }
    // Enter and the blur that follows it would otherwise apply the same number twice and put a
    // second, identical state on the undo stack, so one «Deshacer» would look like a no-op.
    if (parsed === value) return;
    shown.current = parsed;
    onCommit(parsed);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }
    if (event.key === 'Escape') setDraft(format(value));
  };
  return { draft, setDraft, commit, onKeyDown };
}

/**
 * One numeric field of the panel (docs/DESIGN.md §5, Campo numérico). The draft is local while
 * it is being typed and applied on Enter or on blur; text that is not a number simply goes back
 * to the value the model holds.
 */
function NumberField({ label, value, onCommit }: NumberFieldProps): JSX.Element {
  const { draft, setDraft, commit, onKeyDown } = useDraft(value, onCommit);
  return (
    <label className={ROW}>
      {label}
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className={FIELD}
      />
    </label>
  );
}

export interface SegmentPanelProps {
  segments: readonly TrackSegment[];
  selected: number | null;
  lineWidth_m: number;
  onSelect: (index: number) => void;
  onEndpoint: (end: Endpoint, p_m: Vec2) => void;
  onRadius: (radius_m: number) => void;
  onCcw: (ccw: boolean) => void;
  onLineWidth: (w_m: number) => void;
}

/** The list of segments: the keyboard way into the selection, with no pointer involved. */
function SegmentList({
  segments,
  selected,
  onSelect,
}: Pick<SegmentPanelProps, 'segments' | 'selected' | 'onSelect'>): JSX.Element {
  const t = useT();
  if (segments.length === 0) {
    return <p className="text-fg-muted text-sm">{t('sims.trackEditor.noSegments')}</p>;
  }
  return (
    <ul className="flex flex-col gap-2" aria-label={t('sims.trackEditor.segments')}>
      {segments.map((segment, index) => (
        <li key={`${segment.type}-${String(index)}`}>
          <button
            type="button"
            aria-pressed={selected === index}
            // #160: marca del segmento seleccionado, la misma que resalta el lienzo.
            {...(selected === index ? { 'data-selected': 'true' } : {})}
            aria-label={t(`sims.trackEditor.segment${segment.type === 'arc' ? 'Arc' : 'Line'}`, {
              index: index + 1,
            })}
            onClick={() => {
              onSelect(index);
            }}
            className={`${SEGMENT_BUTTON} ${selected === index ? SEGMENT_ON : ''}`}
          >
            {t(`sims.trackEditor.segment${segment.type === 'arc' ? 'Arc' : 'Line'}`, {
              index: index + 1,
            })}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The two fields of one end of the segment, in metres. */
function EndpointFields({
  end,
  p_m,
  labels,
  onEndpoint,
}: {
  end: Endpoint;
  p_m: Vec2;
  labels: readonly [string, string];
  onEndpoint: SegmentPanelProps['onEndpoint'];
}): JSX.Element {
  return (
    <>
      <NumberField
        label={labels[0]}
        value={p_m[0]}
        onCommit={(x_m) => {
          onEndpoint(end, [x_m, p_m[1]]);
        }}
      />
      <NumberField
        label={labels[1]}
        value={p_m[1]}
        onCommit={(y_m) => {
          onEndpoint(end, [p_m[0], y_m]);
        }}
      />
    </>
  );
}

/**
 * Sweep of the arc as a segmented control «Sentido: horario / antihorario» (#159, decision 4).
 * It is the same `ccw` datum the checkbox held, said in the words a learner reads on the canvas:
 * the two options are mutually exclusive, which is what a `radiogroup` means, and neither state
 * is encoded by colour alone (docs/DESIGN.md §8).
 */
function DirectionControl({
  ccw,
  onCcw,
}: {
  ccw: boolean;
  onCcw: SegmentPanelProps['onCcw'];
}): JSX.Element {
  const t = useT();
  const options: readonly { readonly ccw: boolean; readonly label: string }[] = [
    { ccw: false, label: t('sims.trackEditor.directionCw') },
    { ccw: true, label: t('sims.trackEditor.directionCcw') },
  ];
  return (
    <div className={ROW}>
      {t('sims.trackEditor.direction')}
      <div
        role="radiogroup"
        aria-label={t('sims.trackEditor.direction')}
        className="border-border rounded-md flex overflow-hidden border"
      >
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={ccw === option.ccw}
            aria-label={option.label}
            onClick={() => {
              onCcw(option.ccw);
            }}
            className={`${DIRECTION} ${ccw === option.ccw ? DIRECTION_ON : ''}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The radius and the sweep of an arc; a straight segment has neither. */
function ArcFields({
  segment,
  onRadius,
  onCcw,
}: {
  segment: ArcSegment;
  onRadius: SegmentPanelProps['onRadius'];
  onCcw: SegmentPanelProps['onCcw'];
}): JSX.Element {
  const t = useT();
  return (
    <>
      <NumberField
        label={t('sims.trackEditor.field.radius')}
        value={segment.radius_m}
        onCommit={onRadius}
      />
      <DirectionControl ccw={segment.ccw} onCcw={onCcw} />
    </>
  );
}

/** The four endpoint fields plus, for an arc, its radius and sweep. */
function SegmentFields({
  segment,
  onEndpoint,
  onRadius,
  onCcw,
}: {
  segment: TrackSegment;
  onEndpoint: SegmentPanelProps['onEndpoint'];
  onRadius: SegmentPanelProps['onRadius'];
  onCcw: SegmentPanelProps['onCcw'];
}): JSX.Element {
  const t = useT();
  const [from, to] = segmentEndpoints(segment);
  return (
    <div className="mt-3 flex flex-col gap-2">
      <EndpointFields
        end="from"
        p_m={from}
        labels={[t('sims.trackEditor.field.fromX'), t('sims.trackEditor.field.fromY')]}
        onEndpoint={onEndpoint}
      />
      <EndpointFields
        end="to"
        p_m={to}
        labels={[t('sims.trackEditor.field.toX'), t('sims.trackEditor.field.toY')]}
        onEndpoint={onEndpoint}
      />
      {segment.type === 'arc' ? (
        <ArcFields segment={segment} onRadius={onRadius} onCcw={onCcw} />
      ) : null}
    </div>
  );
}

/**
 * Title of the panel: «Segmento N · recta» or «Segmento N · arco» with a segment selected, and
 * the generic heading with none (#160, decision 2). N is one-based, as in the list below it.
 */
function panelTitle(
  t: ReturnType<typeof useT>,
  segment: TrackSegment | undefined,
  selected: number | null,
): string {
  if (segment === undefined || selected === null) return t('sims.trackEditor.segment');
  return t(`sims.trackEditor.segmentTitle.${segment.type === 'arc' ? 'arc' : 'line'}`, {
    index: selected + 1,
  });
}

/**
 * Numeric panel of the selected segment (criterion of #126: it is the keyboard alternative to
 * drawing with the pointer). It edits both endpoints in metres, the radius and the sweep of an
 * arc, and the global painted width of the track.
 */
export function SegmentPanel(props: SegmentPanelProps): JSX.Element {
  const { segments, selected, lineWidth_m, onSelect, onEndpoint, onRadius, onCcw, onLineWidth } =
    props;
  const t = useT();
  const segment = selected === null ? undefined : segments[selected];
  return (
    <section
      className="border-border bg-bg-raised rounded-lg border p-5"
      aria-label={t('sims.trackEditor.segment')}
      data-testid="track-editor-panel"
    >
      <h3 className="text-base font-semibold">{panelTitle(t, segment, selected)}</h3>
      <div className="mt-3">
        <SegmentList segments={segments} selected={selected} onSelect={onSelect} />
      </div>
      {segment === undefined ? (
        <p className="text-fg-muted mt-3 text-sm">{t('sims.trackEditor.noSegment')}</p>
      ) : (
        <SegmentFields
          segment={segment}
          onEndpoint={onEndpoint}
          onRadius={onRadius}
          onCcw={onCcw}
        />
      )}
      <div className="border-border mt-4 border-t pt-4">
        <NumberField
          label={t('sims.trackEditor.field.lineWidth')}
          value={lineWidth_m}
          onCommit={onLineWidth}
        />
      </div>
    </section>
  );
}
