import { useEffect, useRef, useState } from 'react';
import type { JSX, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Vec2 } from '@trayectoria/sim-core';
import { Circle, Scene2D, TrackLayer, createTransform, pxToWorld } from '@trayectoria/widgets';

import { SegmentBar } from './SegmentBar';
import { segmentEndpoints } from './model';
import type { TrackEditorApi } from './useTrackEditor';

// #189 (decisión 1): el lienzo, su mapeo de píxeles a metros y la barra flotante del segmento
// salen de `TrackEditor.tsx` a su propio módulo. Ese archivo ya rozaba el límite de 300 líneas de
// docs/STANDARDS.md §4 y la maquetación nueva de `renderPanel` lo habría pasado.

/**
 * World width the editor shows, in metres. The four presets of sim-core are the widest thing it
 * has to hold: together they span x ∈ [-0.25, 1.20] and y ∈ [-0.40, 0.50], that is 1.45 × 0.90 m.
 * At the 16:9 aspect of `Scene2D` a width of 1.8 m gives 1.01 m of height, so the whole of every
 * preset fits with a margin on the four sides.
 */
export const WORLD_WIDTH_M = 1.8;

/**
 * World point at the centre of the canvas, in metres. The presets are not laid out around the
 * origin — `oval` spans x ∈ [-0.25, 0.85] and y ∈ [0, 0.5] — so a view centred on (0,0) would
 * push them off the canvas. This is the centre of their combined extent, and being a constant it
 * also keeps the pointer mapping fixed: the view never shifts under the learner mid-stroke.
 */
export const SCENE_CENTER_M: [number, number] = [0.475, 0.05];

/** Radius of the marker drawn at the snapped end of the stroke, in metres (spec of #126). */
const SNAP_MARKER_RADIUS_M = 0.015;

/**
 * Radius of the marker drawn at each end of the selected segment, in CSS pixels: 12 px across,
 * so it reads as a ring over the 10 px stroke of the track (#160, precisión a la decisión 1).
 */
const SELECTED_ENDPOINT_RADIUS_PX = 6;

/** Width `Scene2D` falls back to before it has measured its container, in CSS pixels. */
const FALLBACK_CANVAS_WIDTH_PX = 480;

/**
 * Ancho del hueco del lienzo en píxeles CSS, o 0 mientras no esté medido. `Scene2D` deriva su alto
 * de su ancho y de su relación de aspecto, así que la única manera de darle un alto exacto es
 * calcular la relación con el ancho que de verdad tiene (#189, decisión 3).
 */
function useSlotWidth(ref: RefObject<HTMLDivElement | null>, enabled: boolean): number {
  const [width_px, setWidth] = useState(0);
  useEffect(() => {
    const slot = ref.current;
    if (!enabled || slot === null || typeof ResizeObserver !== 'function') return undefined;
    const measure = (): void => {
      const measured_px = slot.getBoundingClientRect().width;
      if (measured_px > 0) setWidth(measured_px);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    return () => {
      observer.disconnect();
    };
  }, [ref, enabled]);
  return width_px;
}

/**
 * Pointer position in world metres, or null before the scene has been laid out. The mapping is
 * rebuilt with the very `createTransform` of `Scene2D` over the canvas it painted, so the pixels
 * the learner clicks and the pixels the scene drew agree by construction (#126, decision 4); it
 * is not recomputed geometry, it is the same pure function fed the same measurements.
 */
function worldOf(host: HTMLElement | null, event: ReactPointerEvent<HTMLElement>): Vec2 | null {
  const canvas = host?.querySelector('canvas') ?? null;
  if (canvas === null) return null;
  const box = canvas.getBoundingClientRect();
  if (box.width <= 0) return null;
  const transform = createTransform({
    widthPx: box.width,
    heightPx: box.height,
    worldWidth_m: WORLD_WIDTH_M,
    center_m: SCENE_CENTER_M,
    dpr: 1,
  });
  return pxToWorld(transform, event.clientX - box.left, event.clientY - box.top);
}

/**
 * Metres the canvas currently paints per CSS pixel. `Circle` sizes its markers in world metres,
 * so a marker that must stay 6 px wide whatever the width of the canvas needs the live scale;
 * the canvas is measured with the same `ResizeObserver` route `Scene2D` uses on its own host.
 */
function useMetresPerPx(hostRef: RefObject<HTMLDivElement | null>): number {
  const [width_px, setWidth] = useState(FALLBACK_CANVAS_WIDTH_PX);
  useEffect(() => {
    const canvas = hostRef.current?.querySelector('canvas') ?? null;
    if (canvas === null || typeof ResizeObserver !== 'function') return;
    const measure = (): void => {
      const measured_px = canvas.getBoundingClientRect().width;
      if (measured_px > 0) setWidth(measured_px);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, [hostRef]);
  return WORLD_WIDTH_M / width_px;
}

/**
 * The selected segment redrawn on top of the track in `--color-primary` at the same line width,
 * with a circle at each of its ends (#160, decision 1): selection is visible on the canvas, not
 * only in the numeric panel.
 */
function SelectedOverlay({
  editor,
  metresPerPx,
}: {
  editor: TrackEditorApi;
  metresPerPx: number;
}): JSX.Element | null {
  const { track, selected } = editor.state;
  const segment = selected === null ? undefined : track.segments[selected];
  if (segment === undefined) return null;
  const [from, to] = segmentEndpoints(segment);
  const radius_m = SELECTED_ENDPOINT_RADIUS_PX * metresPerPx;
  return (
    <>
      <TrackLayer track={{ ...track, segments: [segment] }} color="color-primary" />
      <Circle center_m={[from[0], from[1]]} radius_m={radius_m} color="color-bg-raised" filled />
      <Circle center_m={[from[0], from[1]]} radius_m={radius_m} color="color-primary" />
      <Circle center_m={[to[0], to[1]]} radius_m={radius_m} color="color-bg-raised" filled />
      <Circle center_m={[to[0], to[1]]} radius_m={radius_m} color="color-primary" />
    </>
  );
}

/** The canvas with the track, the preview of the stroke and the snap marker of its start. */
function EditorScene({
  editor,
  metresPerPx,
  aspect,
}: {
  editor: TrackEditorApi;
  metresPerPx: number;
  aspect: number | undefined;
}): JSX.Element {
  const t = useT();
  const { draft } = editor;
  return (
    <Scene2D
      worldWidth_m={WORLD_WIDTH_M}
      center_m={SCENE_CENTER_M}
      // `exactOptionalPropertyTypes`: sin relación de aspecto pedida, `Scene2D` usa la suya (16/9).
      {...(aspect === undefined ? {} : { aspect })}
      description={t('sims.trackEditor.scene')}
    >
      <TrackLayer track={editor.state.track} />
      <SelectedOverlay editor={editor} metresPerPx={metresPerPx} />
      {draft === null ? null : (
        <>
          <TrackLayer track={draft.track} color="color-data-1" />
          <Circle
            center_m={[draft.from[0], draft.from[1]]}
            radius_m={SNAP_MARKER_RADIUS_M}
            color="sim-sensor-on"
            filled
          />
        </>
      )}
    </Scene2D>
  );
}

/**
 * The floating bar of the selected segment, over the top-right corner of the canvas (#159,
 * decision 1). `pointer-events-none` on the layer so the canvas below keeps receiving strokes;
 * the bar itself turns them back on.
 *
 * It belongs to «Seleccionar» and is rendered with no other tool (#180, decision 1): while a
 * stroke is being drawn the bar covers the very corner the pointer needs, and its own controls
 * swallow the `pointerdown` that starts there. The selection is not cleared by the tool change,
 * so coming back to «Seleccionar» brings the same bar back. The `F`/`Supr` shortcuts of #159 are
 * bound on the editor, not on the bar, so they keep working whatever the tool (decision 2).
 */
function SegmentBarLayer({ editor }: { editor: TrackEditorApi }): JSX.Element | null {
  const { selected, track } = editor.state;
  const segment = selected === null ? undefined : track.segments[selected];
  if (segment === undefined || editor.tool !== 'select') return null;
  return (
    <div className="pointer-events-none absolute top-2 right-2">
      <SegmentBar
        segment={segment}
        onFlip={editor.flipArc}
        onRadius={editor.setRadius}
        onDelete={editor.removeSelected}
      />
    </div>
  );
}

/**
 * Relación ancho/alto que le da al lienzo el alto pedido, o `undefined` para dejarle el 16/9 de
 * `Scene2D` (#189, decisión 3).
 */
function useCanvasAspect(
  slotRef: RefObject<HTMLDivElement | null>,
  height_px: number | undefined,
): number | undefined {
  const sized = height_px !== undefined && height_px > 0;
  const slotWidth_px = useSlotWidth(slotRef, sized);
  if (!sized || slotWidth_px <= 0 || height_px === undefined) return undefined;
  return slotWidth_px / height_px;
}

/** Traduce cada evento de puntero a metros del mundo antes de entregárselo al editor. */
function pointerHandlers(
  hostRef: RefObject<HTMLDivElement | null>,
): (handler: (p_m: Vec2) => void) => (event: ReactPointerEvent<HTMLDivElement>) => void {
  return (handler) => (event) => {
    const p_m = worldOf(hostRef.current, event);
    if (p_m !== null) handler(p_m);
  };
}

/** The canvas plus the pointer plumbing that turns its pixels into the model's metres. */
export function CanvasHost({
  editor,
  hostRef,
  height_px,
}: {
  editor: TrackEditorApi;
  hostRef: RefObject<HTMLDivElement | null>;
  /**
   * Alto exacto del lienzo en píxeles CSS (#189, decisión 3). Lo pide la página cuando el editor
   * ocupa la caja del visor, para que el lienzo tenga la misma altura que el visor al que
   * sustituye; sin él, el lienzo conserva la relación 16/9 de `Scene2D`, que es la del playground.
   */
  height_px?: number;
}): JSX.Element {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const aspect = useCanvasAspect(slotRef, height_px);
  const metresPerPx = useMetresPerPx(hostRef);
  const pointer = pointerHandlers(hostRef);
  return (
    <div ref={slotRef} className="relative">
      <div
        ref={hostRef}
        // Without it the browser pans the page instead of letting the drag reach the canvas.
        style={{ touchAction: 'none' }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pointer(editor.pointerDown)(event);
        }}
        onPointerMove={pointer(editor.pointerMove)}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          pointer(editor.pointerUp)(event);
        }}
      >
        <EditorScene editor={editor} metresPerPx={metresPerPx} aspect={aspect} />
      </div>
      <SegmentBarLayer editor={editor} />
    </div>
  );
}
