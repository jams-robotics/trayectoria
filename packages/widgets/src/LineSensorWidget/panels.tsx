import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import type { ReadoutRow } from '../shared/ReadoutPanel';
import type { SensorArrayReading, SensorInput } from './compute';

/** Height of a reading bar at `v_k = 1`, in CSS pixels. */
const BAR_HEIGHT_PX = 40;

/** Which value of the input a slider edits. */
export type SensorParam = 'offset' | 'angle' | 'noise' | 'threshold';

/** Slider ranges of docs/WIDGETS.md, LineSensorWidget. */
const RANGES: Readonly<Record<SensorParam, { min: number; max: number; step: number }>> = {
  offset: { min: -0.05, max: 0.05, step: 0.001 },
  angle: { min: -0.5, max: 0.5, step: 0.01 },
  noise: { min: 0, max: 0.2, step: 0.01 },
  threshold: { min: 0.1, max: 0.9, step: 0.05 },
};

const VALUES: Readonly<Record<SensorParam, (input: SliderInput) => number>> = {
  offset: (input) => input.offset_m,
  angle: (input) => input.angle_rad,
  noise: (input) => input.noiseSigma,
  threshold: (input) => input.threshold,
};

/** The i18n key of the unit of each slider; σ and `u` are dimensionless. */
const UNIT_KEYS: Readonly<Record<SensorParam, string>> = {
  offset: 'widgets.LineSensorWidget.unitM',
  angle: 'widgets.LineSensorWidget.unitRad',
  noise: '',
  threshold: '',
};

/** The part of the input the sliders own. */
export type SliderInput = Omit<SensorInput, 't_s'>;

const ORDER: readonly SensorParam[] = ['offset', 'angle', 'noise', 'threshold'];

/** The four sliders of the widget. */
export function paramsOf(input: SliderInput, t: Translate): readonly ParamPanelParam[] {
  return ORDER.map((key) => ({
    key,
    label: t(`widgets.LineSensorWidget.param${key}`),
    unit: UNIT_KEYS[key] === '' ? '' : t(UNIT_KEYS[key]),
    value: VALUES[key](input),
    ...RANGES[key],
  }));
}

/** Applies one slider change to the input; the widget time is not a slider. */
export function applyChange(input: SliderInput, key: string, value: number): SliderInput {
  if (key === 'offset') return { ...input, offset_m: value };
  if (key === 'angle') return { ...input, angle_rad: value };
  if (key === 'noise') return { ...input, noiseSigma: value };
  if (key === 'threshold') return { ...input, threshold: value };
  return input;
}

/** Decimals of `k̄`, `p` and `y_línea` (m) in the panel and in the live sentence. */
const INDEX_DECIMALS = 2;
const POSITION_DECIMALS = 3;
const OFFSET_DECIMALS = 4;

/** Fixed decimals, never `-0.000`. */
function fixed(value: number, decimals: number): string {
  const text = value.toFixed(decimals);
  return Number(text) === 0 ? (0).toFixed(decimals) : text;
}

function offsetText(offset_m: number, t: Translate): string {
  return `${fixed(offset_m, OFFSET_DECIMALS)} ${t('widgets.LineSensorWidget.unitM')}`;
}

/** `k̄`, `p` and `y_línea`, formatted once here. */
export function readoutRows(reading: SensorArrayReading, t: Translate): readonly ReadoutRow[] {
  return [
    [t('widgets.LineSensorWidget.weightedIndex'), fixed(reading.weightedIndex, INDEX_DECIMALS)],
    [t('widgets.LineSensorWidget.linePosition'), fixed(reading.linePosition, POSITION_DECIMALS)],
    [t('widgets.LineSensorWidget.lineOffset'), offsetText(reading.lineOffset_m, t)],
  ];
}

/** The sentence of the `aria-live` region. */
export function statusOf(reading: SensorArrayReading, t: Translate): string {
  const values = {
    p: fixed(reading.linePosition, POSITION_DECIMALS),
    offset: offsetText(reading.lineOffset_m, t),
  };
  return reading.lineLost
    ? t('widgets.LineSensorWidget.statusLost', values)
    : t('widgets.LineSensorWidget.status', values);
}

/** A reading with two decimals, the precision the bars are read at. */
function reading2(value: number): string {
  return fixed(value, 2);
}

/** One sensor: its bar, its figure and, with `showBinary`, its binary reading. */
function SensorBar({
  k,
  value,
  bit,
  t,
}: {
  k: number;
  value: number;
  bit: 0 | 1 | undefined;
  t: Translate;
}): JSX.Element {
  const label = t('widgets.LineSensorWidget.sensor', { k: String(k) });
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1" data-sensor={k}>
      <div
        className="border-border flex w-full flex-col justify-end border-b"
        style={{ height: `${BAR_HEIGHT_PX}px` }}
      >
        <div
          className="bg-data-1 w-full rounded-t-sm"
          style={{ height: `${(Math.min(Math.max(value, 0), 1) * 100).toFixed(1)}%` }}
          role="img"
          aria-label={`${label}: ${reading2(value)}`}
        />
      </div>
      <span className="text-fg-muted text-xs">{label}</span>
      <span className="text-fg font-mono text-sm tabular-nums" data-testid={`v-${String(k)}`}>
        {reading2(value)}
      </span>
      {bit === undefined ? null : (
        <span
          className="text-fg-muted font-mono text-xs tabular-nums"
          data-testid={`b-${String(k)}`}
        >
          {t('widgets.LineSensorWidget.binary', { k: String(k), b: String(bit) })}
        </span>
      )}
    </div>
  );
}

/** The bars of `v_k` (and `b_k`), with the «línea perdida» warning under them. */
export function SensorBars({
  reading,
  showBinary,
  t,
}: {
  reading: SensorArrayReading;
  showBinary: boolean;
  t: Translate;
}): JSX.Element {
  return (
    <section
      className="bg-bg-raised border-border rounded-lg border p-5"
      aria-label={t('widgets.LineSensorWidget.readings')}
      data-testid="sensor-bars"
    >
      <div className="flex items-end gap-2">
        {reading.values.map((value, k) => (
          <SensorBar
            key={k}
            k={k}
            value={value}
            bit={showBinary ? reading.binary[k] : undefined}
            t={t}
          />
        ))}
      </div>
      {reading.lineLost ? (
        <p className="text-warning mt-3 text-sm font-semibold" data-testid="line-lost">
          {t('widgets.LineSensorWidget.lineLost')}
        </p>
      ) : null}
    </section>
  );
}
