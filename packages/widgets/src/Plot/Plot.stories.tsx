import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';

import { Plot } from './Plot';
import { RingBuffer } from './RingBuffer';
import type { PlotSeries } from './types';

// `order` fixes the story sequence rendered by the /dev/widgets playground explicitly,
// independent of module export iteration order (docs/audits F2-01a: hydration mismatch).
export default { title: 'Plot', order: ['Static', 'Live', 'PlotStress'] };

/** Step response of a P controller, sampled every 40 ms: the shape a learner sees in M6. */
function stepResponse(samples: number, tau_s: number, overshoot: number): number[] {
  return Array.from({ length: samples }, (_unused, index) => {
    const t_s = index * 0.04;
    const decay = Math.exp(-t_s / tau_s);
    return 1 - decay * Math.cos((t_s / tau_s) * overshoot);
  });
}

const SAMPLES = 120;
const TIME_S = Array.from({ length: SAMPLES }, (_unused, index) => index * 0.04);
const STATIC_SERIES: PlotSeries[] = [
  { key: 'p', label: 'Controlador P', unit: 'm', data: stepResponse(SAMPLES, 0.6, 2.4) },
  { key: 'pid', label: 'Controlador PID', unit: 'm', data: stepResponse(SAMPLES, 0.35, 0.9) },
];

/** Two static series with a reference line and a marker: the approved visual snapshot. */
export function Static(): JSX.Element {
  const [markerX, setMarkerX] = useState(1.6);
  return (
    <Plot
      x={{ label: 't', unit: 's', data: TIME_S }}
      series={STATIC_SERIES}
      refLines={[{ y: 1, label: 'Consigna' }]}
      marker={{ x: markerX, onDrag: setMarkerX }}
    />
  );
}

/** Samples the buffer once per frame; returns a counter so the plot sees a new render. */
function useFeed(buffer: RingBuffer, values: (t_s: number) => number[]): void {
  const valuesRef = useRef(values);
  valuesRef.current = values;
  useEffect(() => {
    let handle = 0;
    let start_ms = 0;
    const tick = (now_ms: number): void => {
      if (start_ms === 0) start_ms = now_ms;
      const t_s = (now_ms - start_ms) / 1000;
      buffer.push(t_s, valuesRef.current(t_s));
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(handle);
    };
  }, [buffer]);
}

const LIVE_WINDOW_S = 8;

/** One live series over the 8 s sliding window of docs/DESIGN.md §5. */
export function Live(): JSX.Element {
  const [buffer] = useState(() => new RingBuffer(600, 1));
  useFeed(buffer, (t_s) => [Math.sin(t_s * 1.6) * 0.08]);
  return (
    <Plot
      x={{ label: 't', unit: 's' }}
      series={[{ key: 'error', label: 'Error de línea', unit: 'm' }]}
      live={{ buffer, windowSeconds: LIVE_WINDOW_S }}
      refLines={[{ y: 0, label: 'Sin error' }]}
    />
  );
}

const STRESS_SERIES: PlotSeries[] = [
  { key: 'e', label: 'Error de línea', unit: 'm' },
  { key: 'wl', label: 'Rueda izquierda', unit: 'm' },
  { key: 'wr', label: 'Rueda derecha', unit: 'm' },
  { key: 'u', label: 'Salida del control', unit: 'm' },
];
/** 4 series × 2000 points at 60 Hz, the load of the acceptance criterion of F2-01b. */
const STRESS_CAPACITY = 2000;
/** Frames averaged for the counter: about two seconds at 60 Hz. */
const FPS_WINDOW_FRAMES = 120;
// Unit symbol of the readout. It is a unit, not UI prose, so it carries no i18n key
// (docs/ops/I18N.md §6); as JSX text the lint rule cannot tell the two apart.
const FPS_UNIT = 'fps';

/** Frames per second measured over the last two seconds (decision 5 of the assignment of #83). */
function useMeasuredFps(): number {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let handle = 0;
    let frames = 0;
    let since_ms = 0;
    const tick = (now_ms: number): void => {
      if (since_ms === 0) since_ms = now_ms;
      frames += 1;
      if (frames >= FPS_WINDOW_FRAMES) {
        setFps(Math.round((frames * 1000) / (now_ms - since_ms)));
        frames = 0;
        since_ms = now_ms;
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(handle);
    };
  }, []);
  return fps;
}

/**
 * Stress story of the ticket: four series of 2000 points redrawn every frame, with the measured
 * frame rate shown next to the chart. The criterion is ≥ 55 fps.
 */
export function PlotStress(): JSX.Element {
  const [buffer] = useState(() => {
    const filled = new RingBuffer(STRESS_CAPACITY, STRESS_SERIES.length);
    // Start full, so the very first frame already carries the whole load.
    for (let i = 0; i < STRESS_CAPACITY; i += 1) {
      const t_s = (i - STRESS_CAPACITY) / 60;
      filled.push(t_s, [0, 0, 0, 0].map((_unused, s) => Math.sin(t_s * (1 + s))));
    }
    return filled;
  });
  useFeed(buffer, (t_s) => STRESS_SERIES.map((_unused, s) => Math.sin(t_s * (1 + s))));
  const fps = useMeasuredFps();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-fg-muted font-mono text-xs tabular-nums" data-testid="plot-stress-fps">
        <span>{fps}</span> <span>{FPS_UNIT}</span> · <span>{STRESS_SERIES.length}</span> ×{' '}
        <span>{STRESS_CAPACITY}</span>
      </p>
      <Plot
        x={{ label: 't', unit: 's' }}
        series={STRESS_SERIES}
        live={{ buffer, windowSeconds: STRESS_CAPACITY / 60 }}
        height={240}
      />
    </div>
  );
}
