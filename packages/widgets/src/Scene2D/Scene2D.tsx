import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';

import { tokenColor } from '../shared/theme';
import { Scene2DContext } from './context';
import type { DrawFn, Scene2DContextValue } from './context';
import { createTransform } from './transform';
import type { Transform } from './transform';

/** Default visible aspect of the canvas (docs/WIDGETS.md, Scene2D). */
const DEFAULT_ASPECT = 16 / 9;
/** Width used before the container has been measured, in CSS pixels. */
const FALLBACK_WIDTH_PX = 480;
/** Length of the scale bar drawn bottom-left (docs/DESIGN.md §6: «0.5 m»). */
const SCALE_BAR_M = 0.5;
/** Inset of the scale bar from the bottom-left corner, in CSS pixels. */
const SCALE_BAR_INSET_PX = 12;
/** Height of the end ticks of the scale bar, in CSS pixels. */
const SCALE_BAR_TICK_PX = 5;
/** Gap between the scale bar and its caption, in CSS pixels. */
const SCALE_BAR_GAP_PX = 6;
/** Font of the scale caption; mono xs of docs/DESIGN.md §3. */
const SCALE_FONT = '11px ui-monospace, SFMono-Regular, Menlo, monospace';

export interface Scene2DProps {
  /** World width visible across the canvas, in metres. */
  worldWidth_m: number;
  /** World point drawn at the centre of the canvas, in metres. Defaults to the origin. */
  center_m?: [number, number];
  /** Width over height of the canvas. Defaults to 16/9. */
  aspect?: number;
  /** Textual description of the scene, already translated by the widget that uses it. */
  description: string;
  children: ReactNode;
}

/** Container width in CSS pixels, kept in sync with a `ResizeObserver` (`worldWidth_m` stays visible). */
function useMeasuredWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width_px, setWidth] = useState(FALLBACK_WIDTH_PX);
  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver !== 'function') return;
    const measure = (): void => {
      const measured = element.clientWidth;
      if (measured > 0) setWidth(measured);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return width_px;
}

/** Device pixel ratio of the screen, 1 where the environment does not expose one. */
function devicePixelRatioOf(): number {
  return typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
}

/** Repaints the scene whenever `data-theme` changes on `<html>` (docs/DESIGN.md §7). */
function useThemeRedraw(requestDraw: () => void): void {
  useEffect(() => {
    if (typeof MutationObserver !== 'function' || typeof document === 'undefined') return;
    const observer = new MutationObserver(requestDraw);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      observer.disconnect();
    };
  }, [requestDraw]);
}

/**
 * Registry of the child painters plus the coalescing scheduler: every change of a frame ends in
 * a single `requestAnimationFrame` repaint, and there is no continuous loop (#84, decision 2).
 */
function useSceneRegistry(paint: () => void): {
  painters: React.RefObject<Map<string, DrawFn>>;
  context: Scene2DContextValue;
  requestDraw: () => void;
} {
  const painters = useRef(new Map<string, DrawFn>());
  const frame = useRef(0);
  const paintRef = useRef(paint);
  paintRef.current = paint;

  const requestDraw = useCallback((): void => {
    if (frame.current !== 0) return;
    if (typeof requestAnimationFrame !== 'function') {
      paintRef.current();
      return;
    }
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      paintRef.current();
    });
  }, []);

  const register = useCallback((id: string, draw: DrawFn): (() => void) => {
    painters.current.set(id, draw);
    return () => {
      painters.current.delete(id);
    };
  }, []);

  useEffect(
    () => () => {
      if (frame.current !== 0 && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(frame.current);
      }
    },
    [],
  );

  const context = useMemo<Scene2DContextValue>(
    () => ({ register, requestDraw }),
    [register, requestDraw],
  );
  return { painters, context, requestDraw };
}

/** Scale bar of the bottom-left corner: `0.5 m` measured on the canvas (docs/DESIGN.md §6). */
function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  transform: Transform,
  caption: string,
  colors: { axis: string; label: string },
): void {
  const length_px = SCALE_BAR_M * transform.pxPerM;
  const y_px = transform.heightPx - SCALE_BAR_INSET_PX;
  const from_px = SCALE_BAR_INSET_PX;
  ctx.save();
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(from_px, y_px);
  ctx.lineTo(from_px + length_px, y_px);
  ctx.moveTo(from_px, y_px - SCALE_BAR_TICK_PX);
  ctx.lineTo(from_px, y_px + SCALE_BAR_TICK_PX);
  ctx.moveTo(from_px + length_px, y_px - SCALE_BAR_TICK_PX);
  ctx.lineTo(from_px + length_px, y_px + SCALE_BAR_TICK_PX);
  ctx.stroke();
  ctx.fillStyle = colors.label;
  ctx.font = SCALE_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(caption, from_px, y_px - SCALE_BAR_GAP_PX - SCALE_BAR_TICK_PX);
  ctx.restore();
}

/**
 * The painter of the canvas: clears it, sizes the backing store for the current device pixel
 * ratio, fills the background and runs the registered primitives in order, ending with the
 * scale bar (docs/DESIGN.md §6).
 */
function usePainter(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  transformRef: React.RefObject<Transform | null>,
  paintersRef: React.RefObject<Map<string, DrawFn> | null>,
  scaleCaption: string,
): () => void {
  return useCallback((): void => {
    const canvas = canvasRef.current;
    const transform = transformRef.current;
    const painters = paintersRef.current;
    if (canvas === null || transform === null || painters === null) return;
    const ctx = canvas.getContext('2d');
    if (ctx === null) return;
    canvas.width = transform.deviceWidthPx;
    canvas.height = transform.deviceHeightPx;
    ctx.setTransform(transform.dpr, 0, 0, transform.dpr, 0, 0);
    ctx.clearRect(0, 0, transform.widthPx, transform.heightPx);
    ctx.fillStyle = tokenColor(canvas, 'color-bg-raised');
    ctx.fillRect(0, 0, transform.widthPx, transform.heightPx);
    for (const draw of painters.values()) draw(ctx, transform);
    drawScaleBar(ctx, transform, scaleCaption, {
      axis: tokenColor(canvas, 'sim-axis'),
      label: tokenColor(canvas, 'color-fg-muted'),
    });
  }, [canvasRef, transformRef, paintersRef, scaleCaption]);
}

/**
 * Keeps the mapping in sync with the measured container, the view props and the device pixel
 * ratio, and asks for one repaint per change — so resizing the container keeps `worldWidth_m`
 * visible (criterion of #84).
 */
function useSceneView(
  hostRef: React.RefObject<HTMLDivElement | null>,
  transformRef: React.RefObject<Transform | null>,
  view: { worldWidth_m: number; center_m: readonly [number, number]; aspect: number },
  redraw: { requestDraw: () => void; scaleCaption: string },
): number {
  const { worldWidth_m, center_m, aspect } = view;
  const { requestDraw, scaleCaption } = redraw;
  const width_px = useMeasuredWidth(hostRef);
  const height_px = width_px / (aspect > 0 ? aspect : DEFAULT_ASPECT);
  const [centerX_m, centerY_m] = center_m;

  transformRef.current = createTransform({
    widthPx: width_px,
    heightPx: height_px,
    worldWidth_m,
    center_m,
    dpr: devicePixelRatioOf(),
  });

  useEffect(() => {
    requestDraw();
  }, [requestDraw, width_px, height_px, worldWidth_m, centerX_m, centerY_m, scaleCaption]);
  useThemeRedraw(requestDraw);
  return height_px;
}

/**
 * 2D viewer in physical coordinates (docs/WIDGETS.md, Scene2D; docs/DESIGN.md §6). It owns a
 * single `<canvas>`; every child primitive registers a painter in the context and the canvas
 * repaints them in registration order inside one `requestAnimationFrame` per change — there is
 * no continuous loop (#84, decision 2).
 */
export function Scene2D({
  worldWidth_m,
  center_m = [0, 0],
  aspect = DEFAULT_ASPECT,
  description,
  children,
}: Scene2DProps): JSX.Element {
  const t = useT();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transformRef = useRef<Transform | null>(null);
  const scaleCaption = t('widgets.Scene2D.scale', { length: SCALE_BAR_M });
  const paintersRef = useRef<Map<string, DrawFn> | null>(null);
  const paint = usePainter(canvasRef, transformRef, paintersRef, scaleCaption);
  const { painters, context, requestDraw } = useSceneRegistry(paint);
  paintersRef.current = painters.current;
  const height_px = useSceneView(
    hostRef,
    transformRef,
    { worldWidth_m, center_m, aspect },
    { requestDraw, scaleCaption },
  );

  return (
    <div
      ref={hostRef}
      className="bg-bg-raised border-border relative w-full overflow-hidden rounded-lg border"
      data-testid="scene2d"
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={description}
        className="block w-full"
        style={{ height: `${height_px}px` }}
      />
      <Scene2DContext.Provider value={context}>{children}</Scene2DContext.Provider>
    </div>
  );
}
