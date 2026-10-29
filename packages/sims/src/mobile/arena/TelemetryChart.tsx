import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import { TELEMETRY_WINDOW_S } from './telemetry';
import type { Telemetry, TelemetrySample } from './telemetry';

interface Colors {
  readonly fg: string;
  readonly muted: string;
  readonly grid: string;
  readonly error: string;
  readonly left: string;
  readonly right: string;
  readonly bad: string;
}

function readColors(element: Element): Colors {
  const style = getComputedStyle(element);
  const get = (name: string): string => style.getPropertyValue(name).trim();
  return {
    fg: get('--color-fg'),
    muted: get('--color-fg-muted'),
    grid: get('--color-border'),
    error: get('--color-data-1'),
    left: get('--color-data-2'),
    right: get('--color-data-3'),
    bad: get('--color-error'),
  };
}

interface Band {
  readonly top: number;
  readonly height: number;
  readonly min: number;
  readonly max: number;
}

function yOf(band: Band, value: number): number {
  const k = (value - band.min) / (band.max - band.min || 1);
  return band.top + band.height * (1 - Math.min(Math.max(k, 0), 1));
}

function series(
  context: CanvasRenderingContext2D,
  samples: readonly TelemetrySample[],
  pick: (sample: TelemetrySample) => number,
  frame: { band: Band; t0: number; width: number; color: string; dash: number[] },
): void {
  context.strokeStyle = frame.color;
  context.lineWidth = 2;
  context.setLineDash(frame.dash);
  context.beginPath();
  samples.forEach((sample, i) => {
    const x = ((sample.t_s - frame.t0) / TELEMETRY_WINDOW_S) * frame.width;
    const y = yOf(frame.band, pick(sample));
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
  context.setLineDash([]);
}

function lostSpans(
  context: CanvasRenderingContext2D,
  samples: readonly TelemetrySample[],
  t0: number,
  width: number,
  height: number,
  color: string,
): void {
  context.fillStyle = color;
  context.globalAlpha = 0.18;
  for (const sample of samples) {
    if (sample.lost)
      context.fillRect(((sample.t_s - t0) / TELEMETRY_WINDOW_S) * width, 0, 3, height);
  }
  context.globalAlpha = 1;
}

/** Matches the backing store to the CSS size (capped at 2x) and clears it; `null` without 2D. */
function prepare(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ratio = Math.min(globalThis.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
  if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
  const context = canvas.getContext('2d');
  if (context === null) return null;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
}

/** The zero of the error and the split between the two bands. */
function axes(
  context: CanvasRenderingContext2D,
  width: number,
  zeroY: number,
  splitY: number,
  color: string,
): void {
  context.strokeStyle = color;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, zeroY);
  context.lineTo(width, zeroY);
  context.moveTo(0, splitY);
  context.lineTo(width, splitY);
  context.stroke();
}

function draw(
  canvas: HTMLCanvasElement,
  samples: readonly TelemetrySample[],
  colors: Colors,
  max_radps: number,
): void {
  const context = prepare(canvas);
  if (context === null) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const last = samples[samples.length - 1];
  const t0 = (last?.t_s ?? 0) - TELEMETRY_WINDOW_S;
  const half = height / 2;
  const errorBand: Band = { top: 4, height: half - 12, min: -1, max: 1 };
  const wheelBand: Band = { top: half + 8, height: half - 12, min: 0, max: max_radps };
  lostSpans(context, samples, t0, width, height, colors.bad);
  axes(context, width, yOf(errorBand, 0), half, colors.grid);
  series(context, samples, (s) => s.error, {
    band: errorBand,
    t0,
    width,
    color: colors.error,
    dash: [],
  });
  series(context, samples, (s) => s.omegaL_radps, {
    band: wheelBand,
    t0,
    width,
    color: colors.left,
    dash: [8, 4],
  });
  series(context, samples, (s) => s.omegaR_radps, {
    band: wheelBand,
    t0,
    width,
    color: colors.right,
    dash: [2, 3],
  });
}

/** Swatch of a series in the legend: the colour plus its dash, never colour alone. */
const DASH_CLASS = {
  solid: 'border-solid',
  dashed: 'border-dashed',
  dotted: 'border-dotted',
} as const;

function Swatch({
  className,
  dashed,
}: {
  className: string;
  dashed: keyof typeof DASH_CLASS;
}): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-0 w-4 border-t-2 ${DASH_CLASS[dashed]} ${className}`}
    />
  );
}

/** Which line is which: the error and both wheels. */
function Legend(): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-fg-muted">
      <span className="flex items-center gap-1">
        <Swatch className="border-data-1" dashed="solid" />
        {t('sims.arena.chart.error')}
      </span>
      <span className="flex items-center gap-1">
        <Swatch className="border-data-2" dashed="dashed" />
        {t('sims.arena.chart.left')}
      </span>
      <span className="flex items-center gap-1">
        <Swatch className="border-data-3" dashed="dotted" />
        {t('sims.arena.chart.right')}
      </span>
    </div>
  );
}

export interface TelemetryChartProps {
  readonly telemetry: Telemetry;
  /** Top of the wheel-speed axis, in rad/s: the robot's maximum. */
  readonly max_radps: number;
}

/**
 * Error of the line and the wheel speeds the controller asks for, over the last 8 s. It
 * redraws on every animation frame from the telemetry ring, outside React's render.
 */
export function TelemetryChart({ telemetry, max_radps }: TelemetryChartProps): JSX.Element {
  const t = useT();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const element = canvas.current;
    if (element === null) return undefined;
    const colors = readColors(element);
    let frame = 0;
    const tick = (): void => {
      draw(element, telemetry.samples(), colors, max_radps);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [telemetry, max_radps]);
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-fg">{t('sims.arena.chart.title')}</span>
        <span className="font-mono text-fg-muted">{t('sims.arena.chart.window')}</span>
      </figcaption>
      <Legend />
      <canvas
        ref={canvas}
        className="aspect-[3/1] w-full"
        role="img"
        aria-label={t('sims.arena.chart.errorHint')}
      />
      <p className="text-xs text-fg-muted">{t('sims.arena.chart.errorHint')}</p>
    </figure>
  );
}
