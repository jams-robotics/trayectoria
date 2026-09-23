import { useEffect, useRef } from 'react';
import type { JSX, ReactNode } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { Panel } from './SimPanel';
import type { OpenPanelId } from './SimPanel';

// #189 (decisión 2): mientras se edita la pista, la columna derecha muestra solo el panel del
// segmento. Controlador, Robot, Pista y Gráficas no aplican con el visor fuera de la caja y su
// sitio es justo el que el panel numérico del editor necesita; los cuatro vuelven al pulsar
// «Volver a la simulación».

export interface EditorColumnProps {
  /** El panel numérico que el editor publica mientras está abierto. */
  readonly panel: ReactNode;
  readonly mobile: boolean;
  readonly openId: OpenPanelId;
  readonly setOpenId: (id: OpenPanelId) => void;
  readonly t: Translate;
}

/**
 * Abre el acordeón del panel del editor al entrar a editar y devuelve el grupo al panel que
 * estuviera abierto al salir (#189, decisión 2). Solo actúa en móvil, que es donde los paneles son
 * acordeones y solo uno puede estar abierto a la vez (docs/DESIGN.md §9.4).
 */
function useEditorAccordion(
  mobile: boolean,
  openId: OpenPanelId,
  setOpenId: (id: OpenPanelId) => void,
): void {
  const previous = useRef<OpenPanelId>(openId);
  const latest = useRef(openId);
  latest.current = openId;
  useEffect(() => {
    if (!mobile) return undefined;
    previous.current = latest.current;
    setOpenId('editor');
    return () => {
      setOpenId(previous.current);
    };
  }, [mobile, setOpenId]);
}

/** La columna derecha mientras `view === 'editor'`: el panel del segmento y nada más. */
export function EditorColumn({
  panel,
  mobile,
  openId,
  setOpenId,
  t,
}: EditorColumnProps): JSX.Element {
  useEditorAccordion(mobile, openId, setOpenId);
  return (
    <div
      className="flex min-w-0 flex-col gap-4 lg:w-panel lg:shrink-0"
      data-testid="sim-editor-column"
    >
      <Panel
        id="editor"
        title={t('sims.mobilePage.editorPanel')}
        mobile={mobile}
        openId={openId}
        setOpenId={setOpenId}
      >
        {panel}
      </Panel>
    </div>
  );
}
