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
 * La caja del visor: el visor de `LineFollowerWidget` (oculto con `hidden` mientras se edita, para
 * que la simulación siga viva) y, al editar, `TrackEditorBox` en su lugar (#158, enmienda tras
 * auditoría de PR #169). La página la pasa como `renderViewer`, así que decide ella el envoltorio
 * en lugar de que `TrackEditorBox` alcance el DOM interno del widget con un portal.
 */
export function ViewerBox({
  viewer,
  page,
  store,
  panels,
  onEmptyTrack,
  onSaveTrack,
}: {
  viewer: ReactNode;
  page: ReturnType<typeof usePageState>;
  store: ApiStore;
  panels: EditorPanelStore;
  /** Se llama al volver con el lienzo sin segmentos, para avisar de que la pista se conserva. */
  onEmptyTrack: () => void;
  /** «Guardar» del editor: la pista va a la cuenta o al navegador (#191, decisión 3). */
  onSaveTrack: (name: string, track: Exclude<TrackJson, string>) => Promise<void>;
}): JSX.Element {
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
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div hidden={editing}>{viewer}</div>
      <TrackEditorBox
        open={editing}
        track={page.editorTrack}
        onTrack={page.onTrack}
        onBack={onBack}
        renderPanel={(panel) => <EditorPanelPort store={panels} panel={panel} />}
        onSaveTrack={onSaveTrack}
      />
    </div>
  );
}

/**
 * El panel numérico que el editor entrega por `renderPanel`, encaminado hacia la columna derecha
 * (#189, decisión 2). No pinta nada donde el editor lo dejó: allí ya no hay sitio, y la columna es
 * quien lo muestra.
 */
function EditorPanelPort({
  store,
  panel,
}: {
  store: EditorPanelStore;
  panel: ReactNode;
}): null {
  usePublishedPanel(store, panel);
  return null;
}
