import type { JSX, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Translate } from '@trayectoria/i18n';

import type { PlotMarker } from './types';

export interface MarkerLayerProps {
  marker: PlotMarker;
  xRange: readonly [number, number];
  unit: string;
  t: Translate;
}

/** Arrow step of the marker, as a share of the visible x range (docs/WIDGETS.md, teclado). */
const MARKER_ARROW_FRACTION = 0.02;
const MARKER_SHIFT_FACTOR = 5;
/** Decimals shown for the marker position. */
const READOUT_DECIMALS = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface MarkerHandlers {
  ratio: number;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/** Position and input handlers of the marker; both ways of moving it clamp to the x range. */
function useMarkerHandlers(marker: PlotMarker, xRange: readonly [number, number]): MarkerHandlers {
  const [min, max] = xRange;
  const span = max - min;
  const move = (x: number): void => {
    marker.onDrag?.(clamp(x, min, max));
  };
  return {
    ratio: span === 0 ? 0 : (clamp(marker.x, min, max) - min) / span,
    onKeyDown: (event) => {
      let direction = 0;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') direction = 1;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') direction = -1;
      if (direction === 0) return;
      event.preventDefault();
      const step = span * MARKER_ARROW_FRACTION * (event.shiftKey ? MARKER_SHIFT_FACTOR : 1);
      move(marker.x + direction * step);
    },
    onPointerMove: (event) => {
      if (event.buttons === 0) return;
      const track = event.currentTarget.parentElement;
      if (track === null) return;
      const rect = track.getBoundingClientRect();
      if (rect.width === 0) return;
      move(min + ((event.clientX - rect.left) / rect.width) * span);
    },
  };
}

/**
 * Vertical marker over the plot area: draggable with the pointer and with the arrow keys
 * (docs/WIDGETS.md, Plot; docs/DESIGN.md §8). It is a DOM element rather than a canvas drawing
 * so it can take focus and expose its own `aria` state.
 */
export function MarkerLayer({ marker, xRange, unit, t }: MarkerLayerProps): JSX.Element {
  const { ratio, onKeyDown, onPointerMove } = useMarkerHandlers(marker, xRange);
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={t('widgets.Plot.marker')}
      aria-valuemin={xRange[0]}
      aria-valuemax={xRange[1]}
      aria-valuenow={marker.x}
      aria-valuetext={t('widgets.Plot.markerValue', {
        value: marker.x.toFixed(READOUT_DECIMALS),
        unit,
      })}
      data-testid="plot-marker"
      className="bg-fg-muted absolute top-0 bottom-0 w-[2px] cursor-ew-resize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
      style={{ left: `${String(ratio * 100)}%` }}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        // Pointer capture keeps the drag alive outside the 2 px line; jsdom does not
        // implement it, so it is called only when the environment provides it.
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }}
    />
  );
}

