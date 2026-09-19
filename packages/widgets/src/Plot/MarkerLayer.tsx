import type { JSX, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { Translate } from '@trayectoria/i18n';

import type { PlotArea } from './options';
import type { PlotMarker } from './types';

export interface MarkerLayerProps {
  marker: PlotMarker;
  xRange: readonly [number, number];
  /**
   * Real geometry of uPlot's plot area, in CSS pixels (#104). The axis label channel and the
   * chart's own padding (`options.ts`) shift the plot area in from the card's edge, so the
   * marker is positioned against this rather than a percentage of the whole card.
   */
  plotArea: PlotArea;
  unit: string;
  t: Translate;
}

/** Arrow step of the marker, as a share of the visible x range (docs/WIDGETS.md, teclado). */
const MARKER_ARROW_FRACTION = 0.02;
const MARKER_SHIFT_FACTOR = 5;
/** Decimals shown for the marker position. */
const READOUT_DECIMALS = 2;
/**
 * Width of the invisible grab zone centred on the line, in CSS pixels (#107). The visible line
 * is 2 px wide, so a real mouse press two pixels off it used to miss the element altogether and
 * land on uPlot's `.u-over` layer; docs/DESIGN.md §5 fixes no width for the hit area.
 */
const MARKER_GRAB_PX = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

interface MarkerHandlers {
  /** Left offset of the marker line, in CSS pixels from the card's own edge (#104). */
  left_px: number;
  onKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/**
 * Position and input handlers of the marker; both ways of moving it clamp to the x range.
 * Positioning and the pointer's px → x conversion share uPlot's own plot-area geometry
 * (`plotArea`), not a percentage of the card: the axis label channel and the chart's padding
 * (`options.ts`) shift the plot area in from the card's edge (#104).
 */
function useMarkerHandlers(
  marker: PlotMarker,
  xRange: readonly [number, number],
  plotArea: PlotArea,
): MarkerHandlers {
  const [min, max] = xRange;
  const span = max - min;
  const move = (x: number): void => {
    marker.onDrag?.(clamp(x, min, max));
  };
  const ratio = span === 0 ? 0 : (clamp(marker.x, min, max) - min) / span;
  return {
    left_px: plotArea.left_px + ratio * plotArea.width_px,
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
      if (track === null || plotArea.width_px === 0) return;
      const rect = track.getBoundingClientRect();
      // `rect.left` is the card's own edge, the same origin `plotArea.left_px` is measured from.
      const x_px = event.clientX - rect.left - plotArea.left_px;
      move(min + (x_px / plotArea.width_px) * span);
    },
  };
}

/**
 * Vertical marker over the plot area: draggable with the pointer and with the arrow keys
 * (docs/WIDGETS.md, Plot; docs/DESIGN.md §8). It is a DOM element rather than a canvas drawing
 * so it can take focus and expose its own `aria` state.
 */
export function MarkerLayer({ marker, xRange, plotArea, unit, t }: MarkerLayerProps): JSX.Element {
  const { left_px, onKeyDown, onPointerMove } = useMarkerHandlers(marker, xRange, plotArea);
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
      // A transparent grab zone centred on the line, so a real mouse press near it starts the
      // drag instead of falling through to uPlot's `.u-over` layer (#107). `touch-action: none`
      // keeps the browser from turning the drag into a scroll gesture on a touch screen.
      className="absolute top-0 bottom-0 cursor-ew-resize touch-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
      // `left` stays the line's own position; the box is pulled half its width to the left so
      // the grab zone straddles it (#104 keeps `left_px` as the meaningful geometry).
      style={{
        left: `${String(left_px)}px`,
        width: `${String(MARKER_GRAB_PX)}px`,
        marginLeft: `${String(-MARKER_GRAB_PX / 2)}px`,
      }}
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
    >
      {/*
        The line itself: 2 px wide, at an exact whole-pixel offset inside the grab zone so it
        lands on the same column it occupied before the zone existed (the visual snapshots).
      */}
      <span
        aria-hidden="true"
        className="bg-fg-muted absolute top-0 bottom-0 w-[2px]"
        style={{ left: `${String(MARKER_GRAB_PX / 2)}px` }}
      />
    </div>
  );
}

