import { Fragment } from 'react';
import type { JSX, ReactNode } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { EffectorPanel } from './EffectorPanel';
import { NO_LABELS, labelOf } from './ficha';
import type { ArmLabels } from './ficha';
import { JointSliders } from './JointSliders';
import { MatrixPanel } from './MatrixPanel';
import { linkTransforms } from './matrices';
import type { ArmSim } from './useArmSim';
import type { WorkspaceState } from './workspace/WorkspacePanel';
import { workspacePanel } from './workspace/workspacePanelEntry';

// The panel column of the viewer (F5-01b, #134, decision 3). It lives apart from `ArmViewer.tsx`
// since F5-03 (#136) so that neither file exceeds 300 lines
// (docs/STANDARDS.md §4). The contract with the page does not change: `renderPanel` still receives one
// panel per call, in order, and renders what it returns.

/** One of the side panels of the viewer, ready to be wrapped from outside. */
export interface ArmViewerPanel {
  /**
   * Which of the panels it is; `'matrices'` only appears with `show: ['matrices']` (F5-02) and
   * `'workspace'` with `show: ['workspace']` (F5-03).
   */
  readonly id: 'joints' | 'effector' | 'matrices' | 'workspace';
  /** Panel title, already translated. */
  readonly title: string;
  /** One-line summary, readable with the panel collapsed (for example `x 0.000 y 0.350 z 0.000 m`). */
  readonly summary: string;
  /** The panel exactly as the viewer renders it. */
  readonly content: ReactNode;
}

/**
 * One-line summary of the matrix panel: which link is being looked at, by its readable name
 * when the card gives one (#535).
 */
export function matricesSummary(
  link: string | null,
  t: Translate,
  linkLabels: ReadonlyMap<string, string> = NO_LABELS.links,
): string {
  return link === null ? t('sims.matrices.baseLink') : labelOf(linkLabels, link);
}

/** What the viewer knows about the matrix panel when it builds the column. */
export interface MatricesPanelState {
  readonly show: boolean;
  readonly onHighlight: (link: string | null) => void;
  readonly highlighted: string | null;
}

/** What the viewer knows about the workspace panel when it builds the column. */
export interface WorkspacePanelState {
  readonly show: boolean;
  readonly onChange: (state: WorkspaceState) => void;
}

/** Matrix panel, only with `show: ['matrices']` (#135, decision 5). */
function matricesPanel(
  sim: ArmSim,
  t: Translate,
  matrices: MatricesPanelState,
  linkLabels: ReadonlyMap<string, string>,
): ArmViewerPanel {
  return {
    id: 'matrices',
    title: t('sims.matrices.title'),
    summary: matricesSummary(matrices.highlighted, t, linkLabels),
    // `overflow-hidden` completes the `w-0 min-w-full` of MatrixPanel (docs/DESIGN.md §9.8, #223).
    content: (
      <div className="overflow-hidden">
        <MatrixPanel
          rows={linkTransforms(sim.arm, sim.q_rad)}
          onHighlightLink={matrices.onHighlight}
          linkLabels={linkLabels}
        />
      </div>
    ),
  };
}

/** The side panels of the viewer, in display order. */
export function armPanels(
  sim: ArmSim,
  t: Translate,
  summaries: { readonly joints: string; readonly effector: string },
  matrices: MatricesPanelState,
  workspace: WorkspacePanelState,
  labels: ArmLabels = NO_LABELS,
): readonly ArmViewerPanel[] {
  const panels: ArmViewerPanel[] = [
    {
      id: 'joints',
      title: t('sims.arm.joints'),
      summary: summaries.joints,
      content: (
        <JointSliders
          joints={sim.joints}
          q_rad={sim.q_rad}
          onChange={sim.setJoint}
          labels={labels.joints}
        />
      ),
    },
    {
      id: 'effector',
      title: t('sims.arm.effector'),
      summary: summaries.effector,
      content: <EffectorPanel readout={sim.readout} />,
    },
  ];
  // The matrix panel only exists with `show: ['matrices']` (#135, decision 5); it goes in as one
  // more panel so that the page collapses it on mobile with the same `renderPanel`.
  if (matrices.show) panels.push(matricesPanel(sim, t, matrices, labels.links));
  // The workspace panel, like the matrix one, only with `show: ['workspace']`
  // (#136, decision 4) and as one more panel so that the page collapses it on mobile.
  if (workspace.show) panels.push(workspacePanel(sim.arm, t, workspace.onChange));
  return panels;
}

/** The panel column, wrapped by the consumer if it passed `renderPanel`. */
export function PanelColumn({
  panels,
  renderPanel,
}: {
  panels: readonly ArmViewerPanel[];
  renderPanel: ((panel: ArmViewerPanel) => ReactNode) | undefined;
}): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-5 md:w-panel">
      {panels.map((panel) => (
        <Fragment key={panel.id}>
          {renderPanel === undefined ? panel.content : renderPanel(panel)}
        </Fragment>
      ))}
    </div>
  );
}
