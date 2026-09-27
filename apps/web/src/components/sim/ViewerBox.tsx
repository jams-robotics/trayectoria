import { useCallback } from 'react';
import type { JSX, ReactNode } from 'react';
import type { TrackJson } from '@trayectoria/sims';

import type { ApiStore } from './apiStore';
import type { EditorPanelStore } from './editorPanelStore';
import { usePublishedPanel } from './editorPanelStore';
import { TrackEditorBox } from './TrackEditorBox';
import type { usePageState } from './useMobileSimState';

// Split from `MobileSimIsland.tsx` to keep that file under the limit of
// docs/STANDARDS.md §4. It is still the same viewer box of #158 (amendment after the audit of
// PR #169) and #190 (decision 3).

/**
 * #528 (option 1): the column used to be sticky with a screen-capped height and its own scroll
 * (`max-h-screen` + `overflow-y-auto` from `lg`), which clipped «Gráficas» to its title with no
 * visible scrollbar or any sign that it continued. The column no longer caps its height or
 * scrolls on its own: the page grows and the four plots show in full. Only the viewer keeps a
 * capped, centred size (`VIEWER_CAP`, below), not the whole column.
 */
const LEFT_COLUMN = 'flex min-w-0 flex-1 flex-col gap-3';

/** The viewer is capped at 50 vh (16/9, so 50vh·16/9 wide) and centred, same conditions. */
const VIEWER_CAP =
  '[@media(min-width:1024px)_and_(min-height:640px)]:mx-auto ' +
  '[@media(min-width:1024px)_and_(min-height:640px)]:w-full ' +
  '[@media(min-width:1024px)_and_(min-height:640px)]:max-w-[calc(50vh*16/9)]';

/** What the viewer box receives from the island. */
interface ViewerBoxProps {
  viewer: ReactNode;
  page: ReturnType<typeof usePageState>;
  store: ApiStore;
  panels: EditorPanelStore;
  /** Called when coming back with a canvas without segments, to warn that the track is kept. */
  onEmptyTrack: () => void;
  /** «Guardar» of the editor: the track goes to the account or to the browser (#191, decision 3). */
  onSaveTrack: (name: string, track: Exclude<TrackJson, string>) => Promise<void>;
  /** «Gráficas» under the viewer on desktop (#375); `null` on mobile and while editing. */
  plots?: ReactNode;
}

/**
 * The viewer box: the `LineFollowerWidget` viewer (hidden with `hidden` while editing, so
 * that the simulation stays alive) and, when editing, `TrackEditorBox` in its place (#158, amendment
 * after the audit of PR #169). The page passes it as `renderViewer`, so the page decides the wrapper
 * instead of `TrackEditorBox` reaching the widget's inner DOM with a portal.
 */
export function ViewerBox(props: ViewerBoxProps): JSX.Element {
  const { viewer, page, store, panels, onEmptyTrack, onSaveTrack, plots = null } = props;
  const { closeEditor } = page;
  const editing = page.view === 'editor';
  const onBack = useCallback(
    (emptyTrack: boolean): void => {
      store.read()?.driver.reset();
      closeEditor();
      // #190 (decision 3): a canvas without segments does not replace the track the page was
      // already simulating; that one is kept and the page says so, because otherwise the editor
      // would seem to have done nothing.
      if (emptyTrack) onEmptyTrack();
    },
    [store, closeEditor, onEmptyTrack],
  );
  return (
    <div className={LEFT_COLUMN} data-testid="sim-left-column">
      <div hidden={editing} className={VIEWER_CAP}>
        {viewer}
      </div>
      <TrackEditorBox
        open={editing}
        track={page.editorTrack}
        onTrack={page.onTrack}
        onBack={onBack}
        renderPanel={(panel) => <EditorPanelPort store={panels} panel={panel} />}
        onSaveTrack={onSaveTrack}
      />
      {plots}
    </div>
  );
}

/**
 * The numeric panel the editor hands over through `renderPanel`, routed to the right column
 * (#189, decision 2). It draws nothing where the editor left it: there is no room there, and the
 * column is the one that shows it.
 */
function EditorPanelPort({ store, panel }: { store: EditorPanelStore; panel: ReactNode }): null {
  usePublishedPanel(store, panel);
  return null;
}
