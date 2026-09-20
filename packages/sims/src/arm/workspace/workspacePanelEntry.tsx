import type { ReactNode } from 'react';
import type { Translate } from '@trayectoria/i18n';
import type { ArmSpec } from '@trayectoria/robot-spec';

import { WorkspacePanel } from './WorkspacePanel';
import type { WorkspaceState } from './WorkspacePanel';

// F5-03 (#136, decisión 4): el panel del espacio de trabajo entra en la columna de paneles del
// visor como uno más, con el mismo contrato que los de F5-01b y F5-02, para que la página lo
// pliegue en móvil con su `renderPanel`.

/** El panel del espacio de trabajo tal como lo consume `ArmViewer`. */
export interface WorkspacePanelEntry {
  readonly id: 'workspace';
  readonly title: string;
  readonly summary: string;
  readonly content: ReactNode;
}

/** Resumen de una línea del panel, legible con el panel plegado. */
export function workspaceSummary(t: Translate): string {
  return t('sims.workspace.empty');
}

/** Construye la entrada del panel del espacio de trabajo para la columna del visor. */
export function workspacePanel(
  arm: ArmSpec,
  t: Translate,
  onChange: (state: WorkspaceState) => void,
): WorkspacePanelEntry {
  return {
    id: 'workspace',
    title: t('sims.workspace.title'),
    summary: workspaceSummary(t),
    content: <WorkspacePanel arm={arm} onChange={onChange} />,
  };
}
