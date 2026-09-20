import { Fragment } from 'react';
import type { JSX, ReactNode } from 'react';
import type { Translate } from '@trayectoria/i18n';

import { EffectorPanel } from './EffectorPanel';
import { JointSliders } from './JointSliders';
import { MatrixPanel } from './MatrixPanel';
import { linkTransforms } from './matrices';
import type { ArmSim } from './useArmSim';
import type { WorkspaceState } from './workspace/WorkspacePanel';
import { workspacePanel } from './workspace/workspacePanelEntry';

// La columna de paneles del visor (F5-01b, #134, decisión 3). Vive aparte de `ArmViewer.tsx`
// desde F5-03 (#136) para que ninguno de los dos archivos pase de 300 líneas
// (docs/STANDARDS.md §4). El contrato con la página no cambia: `renderPanel` sigue recibiendo un
// panel por llamada, en orden, y pinta lo que devuelva.

/** Uno de los paneles laterales del visor, listo para envolverlo desde fuera. */
export interface ArmViewerPanel {
  /**
   * Cuál de los paneles es; `'matrices'` solo aparece con `show: ['matrices']` (F5-02) y
   * `'workspace'` con `show: ['workspace']` (F5-03).
   */
  readonly id: 'joints' | 'effector' | 'matrices' | 'workspace';
  /** Título del panel, ya traducido. */
  readonly title: string;
  /** Resumen de una línea, legible con el panel plegado (por ejemplo `x 0.000 y 0.350 z 0.000 m`). */
  readonly summary: string;
  /** El panel tal cual lo pinta el visor. */
  readonly content: ReactNode;
}

/** Resumen de una línea del panel de matrices: qué eslabón se está mirando. */
export function matricesSummary(link: string | null, t: Translate): string {
  return link ?? t('sims.matrices.baseLink');
}

/** Lo que el visor sabe del panel de matrices cuando construye la columna. */
export interface MatricesPanelState {
  readonly show: boolean;
  readonly onHighlight: (link: string | null) => void;
  readonly highlighted: string | null;
}

/** Lo que el visor sabe del panel del espacio de trabajo cuando construye la columna. */
export interface WorkspacePanelState {
  readonly show: boolean;
  readonly onChange: (state: WorkspaceState) => void;
}

/** Panel de matrices, solo con `show: ['matrices']` (#135, decisión 5). */
function matricesPanel(sim: ArmSim, t: Translate, matrices: MatricesPanelState): ArmViewerPanel {
  return {
    id: 'matrices',
    title: t('sims.matrices.title'),
    summary: matricesSummary(matrices.highlighted, t),
    content: (
      <MatrixPanel
        rows={linkTransforms(sim.arm, sim.q_rad)}
        onHighlightLink={matrices.onHighlight}
      />
    ),
  };
}

/** Los paneles laterales del visor, en el orden en que se muestran. */
export function armPanels(
  sim: ArmSim,
  t: Translate,
  summaries: { readonly joints: string; readonly effector: string },
  matrices: MatricesPanelState,
  workspace: WorkspacePanelState,
): readonly ArmViewerPanel[] {
  const panels: ArmViewerPanel[] = [
    {
      id: 'joints',
      title: t('sims.arm.joints'),
      summary: summaries.joints,
      content: <JointSliders joints={sim.joints} q_rad={sim.q_rad} onChange={sim.setJoint} />,
    },
    {
      id: 'effector',
      title: t('sims.arm.effector'),
      summary: summaries.effector,
      content: <EffectorPanel readout={sim.readout} />,
    },
  ];
  // El panel de matrices solo existe con `show: ['matrices']` (#135, decisión 5); va como un
  // panel más para que la página lo pliegue en móvil con el mismo `renderPanel`.
  if (matrices.show) panels.push(matricesPanel(sim, t, matrices));
  // El panel del espacio de trabajo, igual que el de matrices, solo con `show: ['workspace']`
  // (#136, decisión 4) y como un panel más para que la página lo pliegue en móvil.
  if (workspace.show) panels.push(workspacePanel(sim.arm, t, workspace.onChange));
  return panels;
}

/** La columna de paneles, envuelta por el consumidor si pasó `renderPanel`. */
export function PanelColumn({
  panels,
  renderPanel,
}: {
  panels: readonly ArmViewerPanel[];
  renderPanel: ((panel: ArmViewerPanel) => ReactNode) | undefined;
}): JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-5 md:w-72">
      {panels.map((panel) => (
        <Fragment key={panel.id}>
          {renderPanel === undefined ? panel.content : renderPanel(panel)}
        </Fragment>
      ))}
    </div>
  );
}
