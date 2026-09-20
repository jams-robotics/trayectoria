import { useCallback, useMemo, useRef, useState } from 'react';
import type { PresetName, Track, Vec2 } from '@trayectoria/sim-core';

import { continuity } from './continuity';
import type { ContinuityReport } from './continuity';
import { canRedo, canUndo, createHistory, push, redo, undo } from './history';
import type { History } from './history';
import { fromJson, fromPreset, toJson } from './io';
import {
  emptyEditor,
  moveEndpoint,
  removeSegment,
  setArcDirection,
  setLineWidth,
  setRadius,
  select,
} from './model';
import type { Endpoint, EditorState } from './model';
import { ARC_RADIUS_FACTOR, PICK_TOLERANCE_M, arcFromDrag, usePointer } from './useTrackPointer';
import type { DragArc, TrackDraft } from './useTrackPointer';

export { ARC_RADIUS_FACTOR, PICK_TOLERANCE_M, arcFromDrag };
export type { DragArc, TrackDraft };

/** Drawing tool of the toolbar (docs/DESIGN.md §5, segmentado). */
export type TrackTool = 'select' | 'line' | 'arc' | 'erase';

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
  /** Sweeps the selected arc the other way; a no-op when the selection is not an arc (#159). */
  flipArc: () => void;
  /** Removes the selected segment; a no-op with nothing selected (#159). */
  removeSelected: () => void;
  selectSegment: (index: number | null) => void;
  moveEndpoint: (end: Endpoint, p_m: Vec2) => void;
  setLineWidth: (w_m: number) => void;
  /**
   * Empties the canvas, keeping the current `lineWidth_m` (#190, decision 1). It is an edit like
   * any other, not a reset: it goes through the history, so «Deshacer» brings the track back.
   */
  newTrack: () => void;
  applyPreset: (name: PresetName) => void;
  /** Serializes the track; `null` on success, the error message when the JSON is not a track. */
  toJson: () => string;
  loadJson: (json: string) => string | null;
  markSaved: () => void;
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

/** Actions of the floating bar of the selected segment (#159, decisions 1 and 3). */
function useSegmentActions(
  state: EditorState,
  commit: (next: EditorState) => void,
): Pick<TrackEditorApi, 'flipArc' | 'removeSelected'> {
  const { selected } = state;
  return {
    flipArc: useCallback((): void => {
      const segment = selected === null ? undefined : state.track.segments[selected];
      if (selected === null || segment === undefined || segment.type !== 'arc') return;
      commit(setArcDirection(state, selected, !segment.ccw));
    }, [state, selected, commit]),
    removeSelected: useCallback((): void => {
      if (selected === null) return;
      const next = removeSegment(state, selected);
      if (next !== state) commit(next);
    }, [state, selected, commit]),
  };
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
        if (selected === null) return;
        const next = setArcDirection(state, selected, ccw);
        if (next !== state) commit(next);
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

/** «Deshacer» y «Rehacer»: un paso atrás o adelante en el historial (spec de #126). */
function useTimeTravel(
  history: History<EditorState>,
  replace: (next: History<EditorState>) => void,
): Pick<TrackEditorApi, 'undo' | 'redo'> {
  return {
    undo: useCallback(() => {
      replace(undo(history));
    }, [history, replace]),
    redo: useCallback(() => {
      replace(redo(history));
    }, [history, replace]),
  };
}

/**
 * «Nueva» (#190, decisión 1): el lienzo vacío con el ancho de línea que se estaba usando. Pasa por
 * `commit` y no por `reset` como los presets, así que es una edición más del historial y
 * «Deshacer» devuelve la pista que había.
 */
function useNewTrack(state: EditorState, commit: (next: EditorState) => void): () => void {
  const { lineWidth_m } = state.track;
  return useCallback((): void => {
    commit(emptyEditor(lineWidth_m));
  }, [lineWidth_m, commit]);
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
    ...useTimeTravel(history, replace),
    ...usePanel(state, commit),
    ...useSegmentActions(state, commit),
    newTrack: useNewTrack(state, commit),
    selectSegment: useCallback(
      (index: number | null): void => {
        commit(select(state, index));
      },
      [state, commit],
    ),
    ...files,
  };
}
