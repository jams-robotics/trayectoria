import { useCallback } from 'react';
import type { JSX, ReactNode } from 'react';
import type { TrackJson } from '@trayectoria/sims';

import type { ApiStore } from './apiStore';
import type { EditorPanelStore } from './editorPanelStore';
import { usePublishedPanel } from './editorPanelStore';
import { TrackEditorBox } from './TrackEditorBox';
import type { usePageState } from './useMobileSimState';

// Separado de `MobileSimIsland.tsx` para mantener ese archivo bajo el límite de
// docs/STANDARDS.md §4. Sigue siendo la misma caja del visor de #158 (enmienda tras auditoría de
// PR #169) y #190 (decisión 3).

/**
 * #375 (docs/DESIGN.md, "Páginas de simulador"): from `lg` and with a window at least 640 px tall
 * the left column (viewer and «Gráficas») is sticky while the right column scrolls, and scrolls
 * inside if it is taller than the window. Literal classes so Tailwind sees them. #383: the
 * children never shrink, or the capped height squeezes «Gráficas» (its `overflow-hidden` lets
 * it) down to its title and leaves the column's scroll area blank.
 */
const LEFT_COLUMN =
  'flex min-w-0 flex-1 flex-col gap-3 [&>*]:shrink-0 ' +
  '[@media(min-width:1024px)_and_(min-height:640px)]:sticky ' +
  '[@media(min-width:1024px)_and_(min-height:640px)]:top-0 ' +
  '[@media(min-width:1024px)_and_(min-height:640px)]:max-h-screen ' +
  '[@media(min-width:1024px)_and_(min-height:640px)]:overflow-y-auto';

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
  /** Se llama al volver con el lienzo sin segmentos, para avisar de que la pista se conserva. */
  onEmptyTrack: () => void;
  /** «Guardar» of the editor: the track goes to the account or to the browser (#191, decision 3). */
  onSaveTrack: (name: string, track: Exclude<TrackJson, string>) => Promise<void>;
  /** «Gráficas» under the viewer on desktop (#375); `null` on mobile and while editing. */
  plots?: ReactNode;
}

/**
 * La caja del visor: el visor de `LineFollowerWidget` (oculto con `hidden` mientras se edita, para
 * que la simulación siga viva) y, al editar, `TrackEditorBox` en su lugar (#158, enmienda tras
 * auditoría de PR #169). La página la pasa como `renderViewer`, así que decide ella el envoltorio
 * en lugar de que `TrackEditorBox` alcance el DOM interno del widget con un portal.
 */
export function ViewerBox(props: ViewerBoxProps): JSX.Element {
  const { viewer, page, store, panels, onEmptyTrack, onSaveTrack, plots = null } = props;
  const { closeEditor } = page;
  const editing = page.view === 'editor';
  const onBack = useCallback(
    (emptyTrack: boolean): void => {
      store.read()?.driver.reset();
      closeEditor();
      // #190 (decisión 3): un lienzo sin segmentos no reemplaza a la pista que la página ya
      // simulaba; se conserva aquella y se dice, porque si no el editor parecería no haber hecho
      // nada.
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
 * El panel numérico que el editor entrega por `renderPanel`, encaminado hacia la columna derecha
 * (#189, decisión 2). No pinta nada donde el editor lo dejó: allí ya no hay sitio, y la columna es
 * quien lo muestra.
 */
function EditorPanelPort({ store, panel }: { store: EditorPanelStore; panel: ReactNode }): null {
  usePublishedPanel(store, panel);
  return null;
}
