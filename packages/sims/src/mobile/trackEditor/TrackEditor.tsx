import { useCallback, useRef } from 'react';
import type { JSX, ReactNode, RefObject } from 'react';
import type { Track } from '@trayectoria/sim-core';

import { CanvasHost } from './EditorCanvas';
import { useHistoryShortcuts, useSegmentShortcuts } from './useEditorShortcuts';
import { SegmentPanel } from './SegmentPanel';
import { Toolbar } from './Toolbar';
import { useTrackEditor } from './useTrackEditor';
import type { TrackEditorApi } from './useTrackEditor';
import { ContinuityNotice, EditorToast } from './notices';
import { ConfirmReplace, useTrackFiles } from './useTrackFiles';

/** The numeric panel of the selected segment, wired to the editor. */
function Panel({ editor }: { editor: TrackEditorApi }): JSX.Element {
  return (
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
  );
}

/** The canvas host and the numeric panel side by side: the layout of the playground. */
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
      <Panel editor={editor} />
    </div>
  );
}

/**
 * What goes under the toolbar: the playground layout, or the full-width canvas
 * with the panel wherever the page places it (#189, decision 1).
 */
function EditorMain({
  editor,
  hostRef,
  renderPanel,
  canvasHeight_px,
}: {
  editor: TrackEditorApi;
  hostRef: RefObject<HTMLDivElement | null>;
  renderPanel: ((panel: ReactNode) => ReactNode) | undefined;
  canvasHeight_px: number | undefined;
}): JSX.Element {
  if (renderPanel === undefined) return <EditorBody editor={editor} hostRef={hostRef} />;
  return (
    <>
      <CanvasHost
        editor={editor}
        hostRef={hostRef}
        {...(canvasHeight_px === undefined ? {} : { height_px: canvasHeight_px })}
      />
      {renderPanel(<Panel editor={editor} />)}
    </>
  );
}

/** The toolbar, wired to the editor and to its file actions. */
function EditorToolbar({
  editor,
  files,
  compact,
  onSaveTrack,
}: {
  editor: TrackEditorApi;
  files: ReturnType<typeof useTrackFiles>;
  compact: boolean;
  onSaveTrack: ((name: string) => void) | undefined;
}): JSX.Element {
  return (
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
      onNew={files.askNew}
      compact={compact}
      // `exactOptionalPropertyTypes`: an absent prop is absent, not `undefined`.
      {...(onSaveTrack === undefined ? {} : { onSaveTrack })}
    />
  );
}

/** The notices the editor can open: continuity, load error, confirmation, toast. */
function EditorNotices({
  editor,
  files,
}: {
  editor: TrackEditorApi;
  files: ReturnType<typeof useTrackFiles>;
}): JSX.Element {
  return (
    <>
      <ContinuityNotice report={editor.continuity} />
      <LoadError message={files.error} />
      <ConfirmReplace
        pending={files.pending}
        onConfirm={files.confirmPending}
        onCancel={files.cancelPending}
      />
      <EditorToast shown={files.saved} onClose={files.dismiss} />
    </>
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

/**
 * «Guardar» wired to the track the editor has right now, or `undefined` when the page did not
 * ask for it. The track is read from a ref at the moment of the click, so the callback the
 * toolbar gets keeps its identity while the learner draws.
 */
function useSaveTrack(
  editor: TrackEditorApi,
  onSaveTrack: ((name: string, track: Track) => Promise<void>) | undefined,
): ((name: string) => void) | undefined {
  const latest = useRef({ editor, onSaveTrack });
  latest.current = { editor, onSaveTrack };
  const save = useCallback((name: string): void => {
    const save_ = latest.current.onSaveTrack;
    if (save_ === undefined) return;
    void save_(name, latest.current.editor.state.track);
  }, []);
  return onSaveTrack === undefined ? undefined : save;
}

export interface TrackEditorProps {
  /** Track the editor opens on. Defaults to an empty one. */
  initialTrack?: Track;
  /** Called with the edited track after every change, so a page can embed the editor (F4-02b). */
  onChange?: (track: Track) => void;
  /**
   * Wraps the numeric panel, so a page can put it somewhere of its own — e.g. the column of
   * cards beside the viewer box (#189, decision 1; same pattern as `renderPanel` of
   * `LineFollowerWidget` and `ArmViewer`). Without it the panel stays in its 280 px column beside
   * the canvas, which is the layout of the playground.
   *
   * With it the canvas takes the whole width of the editor and the toolbar goes in a single row
   * above it: inside a viewer box of ~600 px there is no room for two columns.
   */
  renderPanel?: (panel: ReactNode) => ReactNode;
  /**
   * Exact height of the canvas in CSS pixels (#189, decision 3): the page gives it the height of the viewer
   * the editor replaces, so that the box does not have to crop with scroll. It only applies together with
   * `renderPanel`; without it, the canvas keeps the 16/9 ratio of `Scene2D`.
   */
  canvasHeight_px?: number;
  /**
   * Saves the track under the name the learner types, in the account or in the browser (F4-06,
   * #191, decision 3). With it the bar shows «Guardar»; without it there is no button, so the
   * playground and its `TrackEditor-*.png` snapshots stay as they were.
   *
   * The promise belongs to the page, which is what knows where it saves and what reports with its
   * toast; the editor only fires it and does not wait for its result.
   */
  onSaveTrack?: (name: string, track: Track) => Promise<void>;
}

/**
 * Track editor of F4-01b: a `Scene2D` canvas where straights and arcs are drawn with the
 * pointer, a toolbar with undo/redo, save, load and presets, and the numeric panel of the
 * selected segment, which is the keyboard route into the same edits. Every geometry decision
 * comes from the pure model of F4-01a; this component only maps pixels to metres and renders.
 */
/**
 * #189: with `renderPanel` the editor lives inside the viewer box, where every pixel of spacing is
 * taken from the canvas; without it, the usual spacing (the playground).
 */
function rootClass(renderPanel: ((panel: ReactNode) => ReactNode) | undefined): string {
  return `flex flex-col outline-none ${renderPanel === undefined ? 'gap-5' : 'gap-3'}`;
}

export function TrackEditor({
  initialTrack,
  onChange,
  renderPanel,
  canvasHeight_px,
  onSaveTrack,
}: TrackEditorProps = {}): JSX.Element {
  // `exactOptionalPropertyTypes`: an absent prop is absent, not `undefined`.
  const editor = useTrackEditor({
    ...(initialTrack === undefined ? {} : { initialTrack }),
    ...(onChange === undefined ? {} : { onChange }),
  });
  const files = useTrackFiles(editor);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useHistoryShortcuts(editor);
  useSegmentShortcuts(editor, rootRef);
  const saveTrack = useSaveTrack(editor, onSaveTrack);

  return (
    // `tabIndex` so a click on the canvas leaves the focus inside the editor and the shortcuts of
    // #159 reach it; the outline is the browser's own only when it is focused by keyboard.
    <div ref={rootRef} tabIndex={-1} className={rootClass(renderPanel)} data-testid="track-editor">
      {/* #189, decision 1: in a single row when the page places the panel outside; in the
          playground the bar still spreads over several lines if it does not fit. */}
      <EditorToolbar
        editor={editor}
        files={files}
        compact={renderPanel !== undefined}
        onSaveTrack={saveTrack}
      />
      <EditorMain
        editor={editor}
        hostRef={hostRef}
        renderPanel={renderPanel}
        canvasHeight_px={canvasHeight_px}
      />
      <EditorNotices editor={editor} files={files} />
    </div>
  );
}
