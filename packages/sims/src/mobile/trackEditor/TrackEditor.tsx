import { useEffect, useRef, useState } from 'react';
import type { JSX, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Track, Vec2 } from '@trayectoria/sim-core';
import { Circle, Scene2D, TrackLayer, createTransform, pxToWorld } from '@trayectoria/widgets';

import { SegmentPanel } from './SegmentPanel';
import { segmentEndpoints } from './model';
import { Toolbar } from './Toolbar';
import { useTrackEditor } from './useTrackEditor';
import type { TrackEditorApi } from './useTrackEditor';
import { ContinuityNotice, EditorToast } from './notices';
import { PresetDialog, useTrackFiles } from './useTrackFiles';

/**
 * World width the editor shows, in metres. The four presets of sim-core are the widest thing it
 * has to hold: together they span x ∈ [-0.25, 1.20] and y ∈ [-0.40, 0.50], that is 1.45 × 0.90 m.
 * At the 16:9 aspect of `Scene2D` a width of 1.8 m gives 1.01 m of height, so the whole of every
 * preset fits with a margin on the four sides.
 */
const WORLD_WIDTH_M = 1.8;

/**
 * World point at the centre of the canvas, in metres. The presets are not laid out around the
 * origin — `oval` spans x ∈ [-0.25, 0.85] and y ∈ [0, 0.5] — so a view centred on (0,0) would
 * push them off the canvas. This is the centre of their combined extent, and being a constant it
 * also keeps the pointer mapping fixed: the view never shifts under the learner mid-stroke.
 */
const SCENE_CENTER_M: [number, number] = [0.475, 0.05];

/** Radius of the marker drawn at the snapped end of the stroke, in metres (spec of #126). */
const SNAP_MARKER_RADIUS_M = 0.015;

/** Diameter of the marker drawn at each end of the selected segment, in CSS pixels (#160). */
const SELECTED_ENDPOINT_DIAMETER_PX = 6;

/** Width `Scene2D` falls back to before it has measured its container, in CSS pixels. */
const FALLBACK_CANVAS_WIDTH_PX = 480;

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
  const radius_m = (SELECTED_ENDPOINT_DIAMETER_PX / 2) * metresPerPx;
  return (
    <>
      <TrackLayer track={{ ...track, segments: [segment] }} color="color-primary" />
      <Circle center_m={[from[0], from[1]]} radius_m={radius_m} color="color-primary" filled />
      <Circle center_m={[to[0], to[1]]} radius_m={radius_m} color="color-primary" filled />
    </>
  );
}

/** The canvas with the track, the preview of the stroke and the snap marker of its start. */
function EditorCanvas({
  editor,
  metresPerPx,
}: {
  editor: TrackEditorApi;
  metresPerPx: number;
}): JSX.Element {
  const t = useT();
  const { draft } = editor;
  return (
    <Scene2D
      worldWidth_m={WORLD_WIDTH_M}
      center_m={SCENE_CENTER_M}
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

/** Ctrl+Z undoes and Ctrl+Shift+Z redoes, anywhere in the editor (spec of #126). */
function useHistoryShortcuts(editor: TrackEditorApi): void {
  const latest = useRef(editor);
  latest.current = editor;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) latest.current.redo();
      else latest.current.undo();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}

/** The canvas plus the pointer plumbing that turns its pixels into the model's metres. */
function CanvasHost({
  editor,
  hostRef,
}: {
  editor: TrackEditorApi;
  hostRef: RefObject<HTMLDivElement | null>;
}): JSX.Element {
  const metresPerPx = useMetresPerPx(hostRef);
  const pointer =
    (handler: (p_m: Vec2) => void) =>
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const p_m = worldOf(hostRef.current, event);
      if (p_m !== null) handler(p_m);
    };
  return (
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
      <EditorCanvas editor={editor} metresPerPx={metresPerPx} />
    </div>
  );
}

/** The canvas host and the numeric panel: everything below the toolbar. */
function EditorBody({
  editor,
  hostRef,
}: {
  editor: TrackEditorApi;
  hostRef: RefObject<HTMLDivElement | null>;
}): JSX.Element {
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_280px]">
      <CanvasHost editor={editor} hostRef={hostRef} />
      <SegmentPanel
        segments={editor.state.track.segments}
        selected={editor.state.selected}
        lineWidth_m={editor.state.track.lineWidth_m}
        onSelect={editor.selectSegment}
        onEndpoint={editor.moveEndpoint}
        onRadius={editor.setRadius}
        onCcw={editor.setCcw}
        onLineWidth={editor.setLineWidth}
      />
    </div>
  );
}

/** The error of the last failed load, in an assertive `aria-live` region (spec of #126). */
function LoadError({ message }: { message: string | null }): JSX.Element | null {
  if (message === null) return null;
  return (
    <p
      role="alert"
      aria-live="assertive"
      data-testid="track-editor-error"
      className="text-error text-sm"
    >
      {message}
    </p>
  );
}

export interface TrackEditorProps {
  /** Track the editor opens on. Defaults to an empty one. */
  initialTrack?: Track;
  /** Called with the edited track after every change, so a page can embed the editor (F4-02b). */
  onChange?: (track: Track) => void;
}

/**
 * Track editor of F4-01b: a `Scene2D` canvas where straights and arcs are drawn with the
 * pointer, a toolbar with undo/redo, save, load and presets, and the numeric panel of the
 * selected segment, which is the keyboard route into the same edits. Every geometry decision
 * comes from the pure model of F4-01a; this component only maps pixels to metres and renders.
 */
export function TrackEditor({ initialTrack, onChange }: TrackEditorProps = {}): JSX.Element {
  // `exactOptionalPropertyTypes`: an absent prop is absent, not `undefined`.
  const editor = useTrackEditor({
    ...(initialTrack === undefined ? {} : { initialTrack }),
    ...(onChange === undefined ? {} : { onChange }),
  });
  const files = useTrackFiles(editor);
  const hostRef = useRef<HTMLDivElement | null>(null);
  useHistoryShortcuts(editor);

  return (
    <div className="flex flex-col gap-5" data-testid="track-editor">
      <Toolbar
        tool={editor.tool}
        onTool={editor.setTool}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onSave={files.save}
        onLoad={files.load}
        onPreset={files.askPreset}
      />
      <EditorBody editor={editor} hostRef={hostRef} />
      <ContinuityNotice report={editor.continuity} />
      <LoadError message={files.error} />
      <PresetDialog
        pending={files.pending}
        onConfirm={files.confirmPreset}
        onCancel={files.cancelPreset}
      />
      <EditorToast shown={files.saved} onClose={files.dismiss} />
    </div>
  );
}
