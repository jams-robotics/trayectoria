import { useCallback, useMemo, useState } from 'react';
import { cross2, distance2, distanceToCenterline, sub2 } from '@trayectoria/sim-core';
import type { Track, TrackSegment, Vec2 } from '@trayectoria/sim-core';

import { DEFAULT_SNAP_TOLERANCE_M, snap } from './snap';
import { addArc, addLine, emptyEditor, removeSegment, select } from './model';
import type { EditorState } from './model';
import type { TrackTool } from './useTrackEditor';

/** Factor over half the chord that gives the radius of a freshly drawn arc (#126, decision 5). */
export const ARC_RADIUS_FACTOR = 1.25;

/** How far from the centerline a click still hits a segment, in metres. */
export const PICK_TOLERANCE_M = 0.03;

/** Radius and sweep of the arc a drag describes. */
export interface DragArc {
  readonly radius_m: number;
  readonly ccw: boolean;
}

/** The stroke being drawn: its two ends and the track that previews it. */
export interface TrackDraft {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly track: Track;
}

/**
 * Radius and sweep of the arc a drag from `from` to `to` describes. The radius is half the chord
 * times `ARC_RADIUS_FACTOR`; `mid` — the last pointer position before the release, or `null` —
 * decides the sweep: on the left of the chord (cross product > 0) it is counter-clockwise
 * (#126, decision 5; golden value: (0,0) → (0.2,0) from above gives `radius_m = 0.125`, `ccw`).
 */
export function arcFromDrag(from: Vec2, to: Vec2, mid: Vec2 | null): DragArc {
  const chord_m = distance2(from, to);
  const side = mid === null ? 0 : cross2(sub2(to, from), sub2(mid, from));
  return { radius_m: (chord_m / 2) * ARC_RADIUS_FACTOR, ccw: side > 0 };
}

/** Index of the segment within `PICK_TOLERANCE_M` of `p_m`, or `null` when none is. */
function pick(track: Track, p_m: Vec2): number | null {
  let best: number | null = null;
  let best_m = PICK_TOLERANCE_M;
  track.segments.forEach((segment, index) => {
    const distance_m = distanceToCenterline({ ...track, segments: [segment] }, p_m);
    if (distance_m <= best_m) {
      best = index;
      best_m = distance_m;
    }
  });
  return best;
}

/** The segment a stroke from `from` to `to` adds, previewed or committed. */
function strokeSegment(tool: TrackTool, from: Vec2, to: Vec2, mid: Vec2 | null): TrackSegment {
  if (tool === 'line') return { type: 'line', from, to };
  const { radius_m, ccw } = arcFromDrag(from, to, mid);
  const [segment] = addArc(emptyEditor(), from, to, radius_m, ccw).track.segments;
  // `addArc` always appends exactly one segment, so this branch only guards the type.
  return segment ?? { type: 'line', from, to };
}

/** The in-progress stroke of the pointer, in world metres. */
interface Stroke {
  readonly from: Vec2;
  readonly last: Vec2 | null;
}

/** Shortest drag that still draws a segment, in metres; below it the click was a click. */
const MIN_STROKE_M = DEFAULT_SNAP_TOLERANCE_M / 10;

export interface PointerHandlers {
  draft: TrackDraft | null;
  down: (p_m: Vec2) => void;
  move: (p_m: Vec2) => void;
  up: (p_m: Vec2) => void;
}

/** What a click of the select or erase tool does: pick a segment, or remove it. */
function clickAt(
  state: EditorState,
  tool: TrackTool,
  p_m: Vec2,
  commit: (next: EditorState) => void,
): void {
  const index = pick(state.track, p_m);
  if (tool === 'erase') {
    if (index !== null) commit(removeSegment(state, index));
    return;
  }
  // A click that changes nothing must not land on the undo stack: «Deshacer» after it would
  // otherwise look like a no-op to the learner.
  if (index !== state.selected) commit(select(state, index));
}

/** The preview of the stroke in progress: the same segment the release would commit. */
function useDraft(stroke: Stroke | null, tool: TrackTool, track: Track): TrackDraft | null {
  return useMemo<TrackDraft | null>(() => {
    if (stroke === null) return null;
    const to = stroke.last ?? stroke.from;
    return {
      from: stroke.from,
      to,
      track: { ...track, segments: [strokeSegment(tool, stroke.from, to, stroke.last)] },
    };
  }, [stroke, tool, track]);
}

/** Pointer handlers of the canvas: they own the stroke in progress and its preview. */
export function usePointer(
  state: EditorState,
  tool: TrackTool,
  commit: (next: EditorState) => void,
): PointerHandlers {
  const [stroke, setStroke] = useState<Stroke | null>(null);
  const draws = tool === 'line' || tool === 'arc';
  const down = useCallback(
    (p_m: Vec2): void => {
      if (draws) setStroke({ from: snap(p_m, state.track), last: null });
      else clickAt(state, tool, p_m, commit);
    },
    [draws, tool, state, commit],
  );
  const move = useCallback((p_m: Vec2): void => {
    setStroke((current) => (current === null ? null : { from: current.from, last: p_m }));
  }, []);
  const up = useCallback(
    (p_m: Vec2): void => {
      setStroke(null);
      if (stroke === null) return;
      const to = snap(p_m, state.track);
      if (distance2(stroke.from, to) < MIN_STROKE_M) return;
      const { radius_m, ccw } = arcFromDrag(stroke.from, to, stroke.last);
      commit(
        tool === 'line'
          ? addLine(state, stroke.from, to)
          : addArc(state, stroke.from, to, radius_m, ccw),
      );
    },
    [stroke, state, tool, commit],
  );
  return { draft: useDraft(stroke, tool, state.track), down, move, up };
}
