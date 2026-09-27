import { useEffect, useRef } from 'react';
import type { JSX, ReactNode } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { Panel } from './SimPanel';
import type { OpenPanelId } from './SimPanel';

// #189 (decision 2): while the track is being edited, the right column shows only the segment
// panel. Controlador, Robot, Pista and Gráficas do not apply with the viewer out of the box and
// their space is exactly what the editor's numeric panel needs; the four come back when
// «Volver a la simulación» is pressed.

export interface EditorColumnProps {
  /** The numeric panel the editor publishes while it is open. */
  readonly panel: ReactNode;
  readonly mobile: boolean;
  readonly openId: OpenPanelId;
  readonly setOpenId: (id: OpenPanelId) => void;
  readonly t: Translate;
}

/**
 * Opens the editor panel accordion when editing starts and returns the group to the panel that
 * was open when leaving (#189, decision 2). It only acts on mobile, which is where the panels are
 * accordions and only one can be open at a time (docs/DESIGN.md §9.4).
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

/** The right column while `view === 'editor'`: the segment panel and nothing else. */
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
