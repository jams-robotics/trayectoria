import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { TrackJson } from '@trayectoria/sims';

// #158 (decisions 1 and 2), amended after the audit of PR #169: the track editor fills the
// box the page itself reserves for the viewer (Simulator passes `renderViewer` to
// `LineFollowerWidget`), not a portal into an internal detail of `@trayectoria/sims`. The box is
// measured with a `ResizeObserver` on its own container, so the editor inherits the width of the
// column without touching the widget's DOM.
//
// #189 (decisions 1 and 3): inside that box the canvas is the protagonist. `TrackEditor` receives
// `renderPanel`, so its numeric panel leaves the box towards the page's right column and
// the canvas keeps the full width; the box no longer clips with `overflow: auto`, because the
// editor sizes itself to fit: it measures the space left for the canvas under the
// toolbar and gives it that aspect ratio.

// The editor comes in with `import()` and only when opened: most visits simulate on a
// preset and have no reason to download the F4-01b editor (docs/ARCHITECTURE.md §8).
const LazyTrackEditor = lazy(async () => {
  const module = await import('@trayectoria/sims');
  return { default: module.TrackEditor };
});

/** Aspect ratio of the editor canvas, the same as the viewer scene (16/9). */
const CANVAS_ASPECT_RATIO = 16 / 9;

/** Minimum canvas height, in pixels: the editor does not fit in less even if the column is narrow. */
const MIN_CANVAS_HEIGHT_PX = 320;

/** The width of the page's own box, observed while the editor is open. */
function useBoxWidth(ref: React.RefObject<HTMLElement | null>, open: boolean): number {
  const [width_px, setWidth] = useState(0);

  useEffect(() => {
    if (!open) return undefined;
    const box = ref.current;
    if (box === null) return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) setWidth(entry.contentRect.width);
    });
    observer.observe(box);
    setWidth(box.getBoundingClientRect().width);
    return () => {
      observer.disconnect();
    };
  }, [ref, open]);

  return width_px;
}

/**
 * The track with geometry: the `TrackJson` without the preset-name branch. `apps/web` cannot
 * import `sim-core` (docs/ARCHITECTURE.md §2), so the `Track` type is not at hand and it is
 * named by what `@trayectoria/sims` does export.
 */
type EditorTrack = Exclude<TrackJson, string>;

/**
 * The track the editor starts from, resolved to geometry. A preset travels as its name, and the
 * editor only understands a `Track`: without resolving it, «Editar» would open an empty canvas instead of
 * the track being viewed. `resolveTrack` lives in the simulator module, which is loaded
 * separately, so the result arrives after the first render and until then there is no track.
 */
function useResolvedTrack(
  track: TrackJson | null,
  open: boolean,
): { initialTrack: EditorTrack | null; resolving: boolean } {
  const [resolved, setResolved] = useState<EditorTrack | null>(null);
  useEffect(() => {
    if (!open) return undefined;
    // «Nueva pista»: there is no track to start from. The editor opens with its own empty canvas,
    // which is what it does without `initialTrack`; `apps/web` cannot build a `Track` because it does
    // not import sim-core (docs/ARCHITECTURE.md §2).
    if (track === null) {
      setResolved(null);
      return undefined;
    }
    if (typeof track !== 'string') {
      setResolved(track);
      return undefined;
    }
    let live = true;
    void import('@trayectoria/sims').then(({ resolveTrack }) => {
      if (live) setResolved(resolveTrack(track));
    });
    return () => {
      live = false;
    };
  }, [track, open]);
  // A preset travels as its name and must be resolved with the simulator module, which arrives
  // after the first render: until then the editor cannot be mounted, or it would open empty for the
  // track that does exist. With `track === null` there is nothing to wait for.
  return { initialTrack: resolved, resolving: track !== null && resolved === null };
}

/**
 * Height of the editor canvas, in pixels: the same the viewer it replaces would have with its
 * 16/9 ratio (#158, decision 2; #189, decision 3), with a minimum so that the editor stays
 * usable in narrow columns.
 *
 * It is the height of the canvas and not of the whole box: the toolbar goes on top and, on mobile,
 * spreads over several rows. Fixing the box, those rows would have taken it from the canvas until
 * leaving it as a strip; fixing the canvas, the box grows as much as it needs and the canvas keeps
 * the viewer's shape.
 */
function canvasHeight_px(width_px: number): number {
  return Math.max(MIN_CANVAS_HEIGHT_PX, Math.round(width_px / CANVAS_ASPECT_RATIO));
}

export interface TrackEditorBoxProps {
  /** Whether the editor fills the viewer box. */
  readonly open: boolean;
  /**
   * The track the editor starts from, to continue from what is shown, or `null` to open it
   * with a blank canvas («Nueva pista», #190, decision 3).
   */
  readonly track: TrackJson | null;
  /**
   * Every editor change that leaves a track with segments; the page restarts the simulation with
   * it. A canvas without segments is not published: it is not a track to simulate on, and the
   * previous one is kept until the editor has some again (#190, decision 3).
   */
  readonly onTrack: (track: TrackJson) => void;
  /**
   * «Volver a la simulación»: returns the box to the viewer and restarts the simulation at `t = 0`.
   * `emptyTrack` warns that the canvas was left without segments, and that therefore the page keeps
   * the track it already had (#190, decision 3).
   */
  readonly onBack: (emptyTrack: boolean) => void;
  /**
   * Where the page places the segment's numeric panel (#189, decision 2): the right column,
   * instead of a second column inside the box.
   */
  readonly renderPanel: (panel: ReactNode) => ReactNode;
  /**
   * «Guardar» of the editor: saves the track under the name the learner types, in the account or
   * in the browser (#191, decision 3). Without it the editor shows no button.
   */
  readonly onSaveTrack: (name: string, track: EditorTrack) => Promise<void>;
}

/**
 * Publishes only tracks with segments (#190, decision 3). An empty canvas (the «Nueva pista» one
 * before the first stroke, or the one left after deleting everything) is not a track to simulate on:
 * sending it would leave the robot with no line to follow. Until the editor has a segment, the page
 * keeps the track it already had, and on returning it warns that it kept it.
 */
function useTrackWithSegments(
  onTrack: (track: TrackJson) => void,
  startsEmpty: boolean,
  open: boolean,
): { publish: (track: EditorTrack) => void; empty: boolean } {
  const latest = useRef(onTrack);
  latest.current = onTrack;
  const [empty, setEmpty] = useState(startsEmpty);
  // The box mounts with the page and is only hidden on close, so the initial value of
  // `useState` is that of the first load and not of this opening: every time the editor opens
  // it must start again from whether it brings a track or not.
  useEffect(() => {
    if (open) setEmpty(startsEmpty);
  }, [open, startsEmpty]);
  const publish = useCallback((track: EditorTrack): void => {
    const hasSegments = track.segments.length > 0;
    setEmpty(!hasSegments);
    if (hasSegments) latest.current(track);
  }, []);
  return { publish, empty };
}

/** The box header: the title and «Volver a la simulación» (#158, decision 3). */
function BoxHeader({ onBack }: { onBack: () => void }): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-fg font-semibold">{t('sims.mobilePage.editorTitle')}</h2>
      <button
        type="button"
        className={
          // `h-[44px]`: `h-11` is 80 px on the D-01 scale (#552).
          'border-border bg-bg-raised text-fg inline-flex h-[44px] items-center rounded-md border ' +
          'px-3 text-sm font-semibold hover:border-fg-muted focus-visible:outline-color-focus ' +
          'focus-visible:outline-2 focus-visible:outline-offset-2'
        }
        data-testid="track-editor-back"
        onClick={onBack}
      >
        {t('sims.mobilePage.editorBack')}
      </button>
    </div>
  );
}

/** The lazy editor with its loading notice; empty while a preset is being resolved. */
function EditorSlot({
  initialTrack,
  resolving,
  onChange,
  renderPanel,
  height_px,
  onSaveTrack,
}: {
  initialTrack: EditorTrack | null;
  resolving: boolean;
  onChange: (track: EditorTrack) => void;
  renderPanel: (panel: ReactNode) => ReactNode;
  height_px: number;
  onSaveTrack: (name: string, track: EditorTrack) => Promise<void>;
}): JSX.Element {
  const t = useT();
  return (
    <Suspense
      fallback={
        <p className="text-fg-muted text-sm" role="status" aria-live="polite">
          {t('sims.mobilePage.loading')}
        </p>
      }
    >
      {resolving ? null : (
        <LazyTrackEditor
          // Without `initialTrack` the editor opens empty, which is «Nueva pista»
          // (`exactOptionalPropertyTypes`: an absent prop is absent, not `undefined`).
          {...(initialTrack === null ? {} : { initialTrack })}
          onChange={onChange}
          renderPanel={renderPanel}
          canvasHeight_px={height_px}
          onSaveTrack={onSaveTrack}
        />
      )}
    </Suspense>
  );
}

/** The F4-01b track editor inside the page's own box reserved for the viewer. */
export function TrackEditorBox({
  open,
  track,
  onTrack,
  onBack,
  renderPanel,
  onSaveTrack,
}: TrackEditorBoxProps): JSX.Element | null {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const width_px = useBoxWidth(boxRef, open);
  const { initialTrack, resolving } = useResolvedTrack(track, open);
  const { publish, empty } = useTrackWithSegments(onTrack, track === null, open);
  if (!open) return null;

  return (
    <div ref={boxRef} className="flex flex-col gap-3" data-testid="track-editor-box">
      <BoxHeader
        onBack={() => {
          onBack(empty);
        }}
      />
      <div>
        <EditorSlot
          initialTrack={initialTrack}
          resolving={resolving}
          onChange={publish}
          renderPanel={renderPanel}
          height_px={canvasHeight_px(width_px)}
          onSaveTrack={onSaveTrack}
        />
      </div>
    </div>
  );
}
