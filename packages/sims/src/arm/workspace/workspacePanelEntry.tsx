import type { ReactNode } from 'react';
import type { Translate } from '@trayectoria/i18n';
import type { ArmSpec } from '@trayectoria/robot-spec';

import { WorkspacePanel } from './WorkspacePanel';
import type { WorkspaceState } from './WorkspacePanel';

// F5-03 (#136, decision 4): the workspace panel enters the viewer's panel column
// as one more, with the same contract as those of F5-01b and F5-02, so that the page
// collapses it on mobile with its `renderPanel`.

/** The workspace panel as `ArmViewer` consumes it. */
export interface WorkspacePanelEntry {
  readonly id: 'workspace';
  readonly title: string;
  readonly summary: string;
  readonly content: ReactNode;
}

/** One-line summary of the panel, readable with the panel collapsed. */
export function workspaceSummary(t: Translate): string {
  return t('sims.workspace.empty');
}

/** Builds the workspace panel entry for the viewer column. */
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
