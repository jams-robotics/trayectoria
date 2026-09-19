import { useCallback, useRef, useState } from 'react';
import type {
  ComponentProps,
  CSSProperties,
  JSX,
  KeyboardEvent,
  PointerEvent,
  ReactNode,
  RefObject,
} from 'react';
import type { Vec2 } from '@trayectoria/sim-core';

import { pxToWorld, worldToPx } from '../Scene2D/transform';
import type { Transform } from '../Scene2D/transform';
import { useSceneTransformValue } from './useSceneTransformValue';

/** A keyboard arrow moves a handle by this much, in the unit of the vector (#86, decision 4). */
export const KEY_STEP = 0.1;
/** Shift raises the arrow step to this value (#86, decision 4: ±1.0). */
export const SHIFT_STEP = 1;
// DESIGN.md §5 Slider: área de arrastre 24 px
/** Side of the square hit area of a handle, in CSS pixels. */
const HANDLE_PX = 24;

/** The arrow keys as a step of the handle in world units; anything else is `null`. */
function arrowDelta(key: string, factor: number): Vec2 | null {
  if (key === 'ArrowRight') return [factor, 0];
  if (key === 'ArrowLeft') return [-factor, 0];
  if (key === 'ArrowUp') return [0, factor];
  if (key === 'ArrowDown') return [0, -factor];
  return null;
}

export interface DragHandleProps {
  /** Current tip of the handle in world units, relative to `from`. */
  value: Vec2;
  /** Tail the handle hangs from, in world units. Defaults to the origin. */
  from?: Vec2;
  /** Accessible name, already translated by the widget (docs/ops/I18N.md §6). */
  label: string;
  /** Receives the new tip in world units, relative to `from`. */
  onChange: (next: Vec2) => void;
  /** Mapping of the scene, or null before it has been measured. */
  transform: Transform | null;
  /** Element the pointer coordinates are measured against; the overlay itself. */
  hostRef: RefObject<HTMLDivElement | null>;
}

/**
 * Pointer handlers of a handle: a drag converts canvas pixels to world metres with the mapping
 * the scene is currently using (#86, decision 3). The pointer is captured, so a fast drag does
 * not lose the handle as the cursor leaves its 28 px box.
 */
function useDragPointer({
  from = [0, 0],
  onChange,
  transform,
  hostRef,
}: DragHandleProps): Pick<
  ComponentProps<'button'>,
  'onPointerDown' | 'onPointerMove' | 'onPointerUp'
> {
  const dragging = useRef(false);
  const moveTo = useCallback(
    (event: PointerEvent<HTMLButtonElement>): void => {
      const host = hostRef.current;
      if (host === null || transform === null) return;
      const rect = host.getBoundingClientRect();
      const [x_m, y_m] = pxToWorld(transform, event.clientX - rect.left, event.clientY - rect.top);
      onChange([x_m - from[0], y_m - from[1]]);
    },
    [hostRef, transform, onChange, from],
  );
  return {
    onPointerDown: (event) => {
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      moveTo(event);
    },
    onPointerMove: (event) => {
      if (dragging.current) moveTo(event);
    },
    onPointerUp: (event) => {
      dragging.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
  };
}

/** Absolute placement of a handle over the canvas, in CSS pixels of the overlay. */
function handleStyle(transform: Transform | null, tip: Vec2): CSSProperties {
  const [x_px, y_px] = transform === null ? [0, 0] : worldToPx(transform, tip[0], tip[1]);
  return {
    left: `${String(x_px - HANDLE_PX / 2)}px`,
    top: `${String(y_px - HANDLE_PX / 2)}px`,
    width: `${String(HANDLE_PX)}px`,
    height: `${String(HANDLE_PX)}px`,
    visibility: transform === null ? 'hidden' : 'visible',
  };
}

/**
 * The draggable tip of a vector: a transparent focusable control laid over the canvas, because
 * `Scene2D` paints but does not interact (#86, decision 3). Arrows move it ±0.1 and Shift+arrow
 * ±1.0 in the unit of the vector (#86, decision 4).
 */
export function DragHandle(props: DragHandleProps): JSX.Element {
  const { value, from = [0, 0], label, onChange, transform } = props;
  const pointer = useDragPointer(props);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const delta = arrowDelta(event.key, event.shiftKey ? SHIFT_STEP : KEY_STEP);
    if (delta === null) return;
    event.preventDefault();
    onChange([value[0] + delta[0], value[1] + delta[1]]);
  };

  return (
    <button
      type="button"
      aria-label={label}
      data-handle={label}
      className={
        'border-focus/0 hover:border-focus focus-visible:outline-focus absolute touch-none' +
        ' cursor-grab rounded-full border-2 focus-visible:outline-2 focus-visible:outline-offset-2'
      }
      style={handleStyle(transform, [from[0] + value[0], from[1] + value[1]])}
      onKeyDown={onKeyDown}
      {...pointer}
    />
  );
}

export interface SceneOverlayProps {
  /** Renders the handles once the mapping of the scene is known. */
  children: (context: {
    transform: Transform | null;
    hostRef: RefObject<HTMLDivElement | null>;
  }) => ReactNode;
}

/**
 * Transparent layer over the canvas of a `Scene2D` that hosts its interactive handles. It must
 * be rendered as a child of the scene, which positions it relative to the canvas (#86,
 * decision 3); it never paints, so the drawing stays with the primitives.
 */
export function SceneOverlay({ children }: SceneOverlayProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const transform = useSceneTransformValue(host);
  return (
    <div
      ref={(element) => {
        hostRef.current = element;
        setHost(element);
      }}
      className="absolute inset-0"
      data-testid="scene-overlay"
    >
      {children({ transform, hostRef })}
    </div>
  );
}
