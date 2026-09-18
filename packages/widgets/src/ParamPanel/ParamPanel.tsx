import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, JSX, KeyboardEvent } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

/** One editable parameter of the panel (docs/WIDGETS.md, ParamPanel). */
export interface ParamPanelParam {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  description?: string;
}

/** Emits the value already clamped to [min, max] and snapped to the step. */
export type ParamChangeHandler = (key: string, value: number) => void;

export interface ParamPanelProps {
  params: readonly ParamPanelParam[];
  onChange: ParamChangeHandler;
  layout?: 'stack' | 'inline';
}

const SHIFT_FACTOR = 10;
// Enough decimals to absorb float noise (0.1 + 0.2 → 0.30000000000000004) without showing it.
const MAX_DECIMALS = 6;

/** Clamps to [min, max] and snaps to the step grid anchored at min. */
export function quantize(value: number, { min, max, step }: ParamPanelParam): number {
  const clamped = Math.min(Math.max(value, min), max);
  if (step <= 0) return clamped;
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Number(Math.min(Math.max(snapped, min), max).toFixed(MAX_DECIMALS));
}

/** Formats a number for display: no trailing zeros, no floating point noise. */
export function format(value: number): string {
  return String(Number(value.toFixed(MAX_DECIMALS)));
}

const TRACK = 'trayectoria-slider h-6 w-full min-w-0 cursor-pointer appearance-none bg-transparent';
const FIELD =
  'border-border bg-bg text-fg rounded-sm h-8 w-20 border px-2 text-right font-mono text-sm tabular-nums';

// Slider of docs/DESIGN.md §5: 4 px track in `border`, active segment in `primary`, 20 px thumb
// filled `bg-raised` with a 2 px `primary` ring and `shadow-sm`. The pseudo-elements of
// <input type="range"> cannot be reached from utility classes, so they live in one style block.
const SLIDER_CSS = `
.trayectoria-slider { --fill: 0%; }
.trayectoria-slider::-webkit-slider-runnable-track {
  height: 4px; border-radius: 2px;
  background: linear-gradient(to right,
    var(--color-primary) var(--fill), var(--color-border) var(--fill));
}
.trayectoria-slider::-moz-range-track {
  height: 4px; border-radius: 2px; background: var(--color-border);
}
.trayectoria-slider::-moz-range-progress {
  height: 4px; border-radius: 2px; background: var(--color-primary);
}
.trayectoria-slider::-webkit-slider-thumb {
  appearance: none; width: 20px; height: 20px; margin-top: -8px;
  border-radius: 999px; border: 2px solid var(--color-primary);
  background: var(--color-bg-raised); box-shadow: var(--shadow-sm);
}
.trayectoria-slider::-moz-range-thumb {
  width: 16px; height: 16px; border-radius: 999px;
  border: 2px solid var(--color-primary);
  background: var(--color-bg-raised); box-shadow: var(--shadow-sm);
}
.trayectoria-slider:focus-visible { outline: none; }
.trayectoria-slider:focus-visible::-webkit-slider-thumb {
  outline: 2px solid var(--color-focus); outline-offset: 2px;
}
.trayectoria-slider:focus-visible::-moz-range-thumb {
  outline: 2px solid var(--color-focus); outline-offset: 2px;
}
`;

/** Share of the track left of the thumb, for the active segment of the WebKit track. */
function fillStyle({ min, max, value }: ParamPanelParam): CSSProperties {
  const ratio = max <= min ? 0 : (Math.min(Math.max(value, min), max) - min) / (max - min);
  const style: Record<string, string> = { '--fill': `${String(ratio * 100)}%` };
  return style;
}

/** Keeps a text draft in sync with the value the parent owns. */
function useFieldDraft(value: number): [string, (draft: string) => void] {
  const [draft, setDraft] = useState(() => format(value));
  const shown = useRef(value);
  useEffect(() => {
    if (shown.current !== value) {
      shown.current = value;
      setDraft(format(value));
    }
  }, [value]);
  return [draft, setDraft];
}

function arrowDirection(key: string): number {
  if (key === 'ArrowRight' || key === 'ArrowUp') return 1;
  if (key === 'ArrowLeft' || key === 'ArrowDown') return -1;
  return 0;
}

interface RowControls {
  commit: (raw: string) => void;
  reset: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/** Arrows move one step (ten with Shift), Enter applies, Escape cancels (docs/DESIGN.md §5). */
function useRowControls(
  param: ParamPanelParam,
  onChange: ParamChangeHandler,
  draft: string,
  setDraft: (draft: string) => void,
): RowControls {
  const reset = (): void => {
    setDraft(format(param.value));
  };
  const commit = (raw: string): void => {
    const parsed = Number(raw.replace(',', '.').trim());
    if (raw.trim() === '' || Number.isNaN(parsed)) {
      reset();
      return;
    }
    const next = quantize(parsed, param);
    setDraft(format(next));
    onChange(param.key, next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const direction = arrowDirection(event.key);
    if (direction !== 0) {
      event.preventDefault();
      const factor = event.shiftKey ? SHIFT_FACTOR : 1;
      onChange(param.key, quantize(param.value + direction * param.step * factor, param));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      commit(draft);
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      reset();
    }
  };
  return { commit, reset, onKeyDown };
}

interface RowPartProps {
  param: ParamPanelParam;
  onChange: ParamChangeHandler;
  t: Translate;
  controls: RowControls;
  draft: string;
  setDraft: (draft: string) => void;
}

/** Header of the slider: name on the left, editable numeric field with unit on the right. */
function RowHeader({ param, t, controls, draft, setDraft }: RowPartProps): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm font-medium">{param.label}</span>
      <span className="flex items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          className={FIELD}
          value={draft}
          aria-label={t('widgets.ParamPanel.value', { label: param.label })}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={controls.onKeyDown}
          onBlur={(event) => {
            controls.commit(event.target.value);
          }}
        />
        <span className="text-fg-muted font-mono text-xs">{param.unit}</span>
      </span>
    </div>
  );
}

/** Track with the range under it (docs/DESIGN.md §5, §8). */
function RowTrack({ param, onChange, t, controls }: RowPartProps): JSX.Element {
  return (
    <>
      <input
        type="range"
        className={TRACK}
        min={param.min}
        max={param.max}
        step={param.step}
        value={param.value}
        style={fillStyle(param)}
        aria-label={t('widgets.ParamPanel.slider', { label: param.label, unit: param.unit })}
        aria-valuenow={param.value}
        aria-valuemin={param.min}
        aria-valuemax={param.max}
        aria-valuetext={t('widgets.ParamPanel.valueText', {
          value: format(param.value),
          unit: param.unit,
        })}
        onKeyDown={controls.onKeyDown}
        onChange={(event) => {
          onChange(param.key, quantize(Number(event.target.value), param));
        }}
      />
      <div className="text-fg-muted flex justify-between font-mono text-xs tabular-nums">
        <span>{format(param.min)}</span>
        <span>{format(param.max)}</span>
      </div>
    </>
  );
}

function ParamRow({
  param,
  onChange,
  t,
}: {
  param: ParamPanelParam;
  onChange: ParamChangeHandler;
  t: Translate;
}): JSX.Element {
  const [draft, setDraft] = useFieldDraft(param.value);
  const controls = useRowControls(param, onChange, draft, setDraft);
  const parts: RowPartProps = { param, onChange, t, controls, draft, setDraft };
  return (
    <div className="min-w-0 flex-1">
      <RowHeader {...parts} />
      <RowTrack {...parts} />
      {param.description === undefined ? null : (
        <p className="text-fg-muted mt-1 text-sm">{param.description}</p>
      )}
    </div>
  );
}

/**
 * Sliders with a numeric field, unit and range (docs/WIDGETS.md; Slider of docs/DESIGN.md §5).
 * Keyboard: arrows move one step, Shift+arrow ten steps, Enter applies the typed value.
 */
export function ParamPanel({ params, onChange, layout = 'stack' }: ParamPanelProps): JSX.Element {
  const t = useT();
  const status = params
    .map((param) =>
      t('widgets.ParamPanel.status', {
        label: param.label,
        value: format(param.value),
        unit: param.unit,
      }),
    )
    .join(' · ');
  return (
    <section
      className="bg-bg-raised border-border rounded-lg border p-6"
      aria-label={t('widgets.ParamPanel.title')}
      data-layout={layout}
    >
      <style>{SLIDER_CSS}</style>
      <div className={layout === 'inline' ? 'flex flex-wrap gap-6' : 'flex flex-col gap-5'}>
        {params.map((param) => (
          <ParamRow key={param.key} param={param} onChange={onChange} t={t} />
        ))}
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
