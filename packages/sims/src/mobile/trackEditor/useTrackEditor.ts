import { useCallback, useMemo, useRef, useState } from 'react';
import { cross2, distance2, distanceToCenterline, sub2 } from '@trayectoria/sim-core';
import type { PresetName, Track, TrackSegment, Vec2 } from '@trayectoria/sim-core';

import { continuity } from './continuity';
import type { ContinuityReport } from './continuity';
import { canRedo, canUndo, createHistory, push, redo, undo } from './history';
import type { History } from './history';
import { fromJson, fromPreset, toJson } from './io';
import {
  addArc,
  addLine,
  emptyEditor,
  moveEndpoint,
  removeSegment,
  select,
  setLineWidth,
  setRadius,
} from './model';
import type { Endpoint, EditorState } from './model';
import { DEFAULT_SNAP_TOLERANCE_M, snap } from './snap';

/** Drawing tool of the toolbar (docs/DESIGN.md §5, segmentado). */
export type TrackTool = 'select' | 'line' | 'arc' | 'erase';

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

export interface UseTrackEditorOptions {
  /** Track the editor opens on. Defaults to an empty one. */
  initialTrack?: Track;
  /** Called with the track after every committed change, for the page that embeds the editor. */
  onChange?: (track: Track) => void;
}

export interface TrackEditorApi {
  readonly state: EditorState;
  readonly tool: TrackTool;
  readonly draft: TrackDraft | null;
  readonly continuity: ContinuityReport;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** True when the track changed since the last save, load or preset. */
  readonly dirty: boolean;
  setTool: (tool: TrackTool) => void;
  pointerDown: (p_m: Vec2) => void;
  pointerMove: (p_m: Vec2) => void;
  pointerUp: (p_m: Vec2) => void;
  undo: () => void;
  redo: () => void;
  setRadius: (radius_m: number) => void;
  setCcw: (ccw: boolean) => void;
  selectSegment: (index: number | null) => void;
  moveEndpoint: (end: Endpoint, p_m: Vec2) => void;
  setLineWidth: (w_m: number) => void;
  applyPreset: (name: PresetName) => void;
  /** Serializes the track; `null` on success, the error message when the JSON is not a track. */
  toJson: () => string;
  loadJson: (json: string) => string | null;
  markSaved: () => void;
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

/** Undo/redo history over the editor state plus the `onChange` notification of every commit. */
function useHistory(
  initial: EditorState,
  onChange: ((track: Track) => void) | undefined,
): [History<EditorState>, (next: EditorState) => void, (next: History<EditorState>) => void] {
  const [history, setHistory] = useState(() => createHistory(initial));
  const notify = useRef(onChange);
  notify.current = onChange;
  const commit = useCallback((next: EditorState): void => {
    setHistory((current) => push(current, next));
    notify.current?.(next.track);
  }, []);
  const replace = useCallback((next: History<EditorState>): void => {
    setHistory(next);
    notify.current?.(next.present.track);
  }, []);
  return [history, commit, replace];
}

/** Shortest drag that still draws a segment, in metres; below it the click was a click. */
const MIN_STROKE_M = DEFAULT_SNAP_TOLERANCE_M / 10;

interface PointerHandlers {
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
function usePointer(
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

/** Edits of the numeric panel, the keyboard alternative to drawing (criterion of #126). */
function usePanel(
  state: EditorState,
  commit: (next: EditorState) => void,
): Pick<TrackEditorApi, 'setRadius' | 'setCcw' | 'moveEndpoint' | 'setLineWidth'> {
  const { selected } = state;
  return {
    setRadius: useCallback(
      (radius_m: number): void => {
        if (selected !== null) commit(setRadius(state, selected, radius_m));
      },
      [state, selected, commit],
    ),
    setCcw: useCallback(
      (ccw: boolean): void => {
        const segment = selected === null ? undefined : state.track.segments[selected];
        if (selected === null || segment === undefined || segment.type !== 'arc') return;
        // The same radius with the opposite sweep: `setRadius` rebuilds the arc through both
        // endpoints, so flipping `ccw` first and reusing it keeps them where they were.
        const flipped: TrackSegment = { ...segment, ccw };
        const segments = state.track.segments.map((current, index) =>
          index === selected ? flipped : current,
        );
        const flippedState: EditorState = { ...state, track: { ...state.track, segments } };
        commit(setRadius(flippedState, selected, segment.radius_m));
      },
      [state, selected, commit],
    ),
    moveEndpoint: useCallback(
      (end: Endpoint, p_m: Vec2): void => {
        if (selected !== null) commit(moveEndpoint(state, selected, end, p_m));
      },
      [state, selected, commit],
    ),
    setLineWidth: useCallback(
      (w_m: number): void => {
        commit(setLineWidth(state, w_m));
      },
      [state, commit],
    ),
  };
}

/** Whatever replaces the whole track at once: a preset, a loaded file, a save mark. */
function useWholeTrack(
  state: EditorState,
  replace: (next: History<EditorState>) => void,
): [Track, Pick<TrackEditorApi, 'applyPreset' | 'toJson' | 'loadJson' | 'markSaved'>] {
  const [saved, setSaved] = useState(state.track);
  const reset = useCallback(
    (next: EditorState): void => {
      replace(createHistory(next));
      setSaved(next.track);
    },
    [replace],
  );
  return [
    saved,
    {
      applyPreset: useCallback(
        (name: PresetName): void => {
          reset(fromPreset(name));
        },
        [reset],
      ),
      toJson: useCallback(() => toJson(state), [state]),
      loadJson: useCallback(
        (json: string): string | null => {
          const parsed = fromJson(json);
          if (!parsed.ok) return parsed.error;
          reset(parsed.value);
          return null;
        },
        [reset],
      ),
      markSaved: useCallback(() => {
        setSaved(state.track);
      }, [state.track]),
    },
  ];
}

/**
 * State of the track editor: the edited track with its selection, the active tool, the stroke
 * being previewed, the undo/redo history and the continuity report. Every geometry decision is
 * delegated to the pure model of F4-01a; this hook only wires the interaction to it.
 */
export function useTrackEditor(options: UseTrackEditorOptions = {}): TrackEditorApi {
  const { initialTrack, onChange } = options;
  const initial = useMemo<EditorState>(
    () => (initialTrack === undefined ? emptyEditor() : { track: initialTrack, selected: null }),
    [initialTrack],
  );
  const [history, commit, replace] = useHistory(initial, onChange);
  const [tool, setTool] = useState<TrackTool>('select');
  const state = history.present;
  const { draft, down, move, up } = usePointer(state, tool, commit);
  const [saved, files] = useWholeTrack(state, replace);

  return {
    state,
    tool,
    draft,
    continuity: useMemo(() => continuity(state.track), [state.track]),
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    dirty: state.track !== saved,
    setTool,
    pointerDown: down,
    pointerMove: move,
    pointerUp: up,
    undo: useCallback(() => {
      replace(undo(history));
    }, [history, replace]),
    redo: useCallback(() => {
      replace(redo(history));
    }, [history, replace]),
    ...usePanel(state, commit),
    selectSegment: useCallback(
      (index: number | null): void => {
        commit(select(state, index));
      },
      [state, commit],
    ),
    ...files,
  };
}
