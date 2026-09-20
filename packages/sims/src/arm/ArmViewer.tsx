import { useEffect, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { RobotSpec } from '@trayectoria/robot-spec';
import type { URDFRobot } from 'urdf-loader';

import { PanelColumn, armPanels } from './armPanels';
import type { ArmViewerPanel } from './armPanels';
import {
  HIDDEN_WORKSPACE,
  SceneColumn,
  panelSummaries,
  useHighlightedLink,
  useWorkspaceCloud,
} from './ArmScene';
import { loadUrdf } from './loadUrdf';
import { useArmSim } from './useArmSim';

// F5-01a (#133): visor URDF con las props de `ArmViewerWidget` (docs/WIDGETS.md). `show` acepta
// las tres opciones del catálogo; `'frames'` es de F5-01a y `'matrices'` de F5-02 (#135,
// decisiones 4 y 5). El espacio de trabajo sigue siendo F5-03. La escena 3D y sus hooks de
// estado viven en `ArmScene.tsx`, y la columna de paneles en `armPanels.tsx`, separados desde
// F5-03 (#136) para que ningún archivo pase de 300 líneas (docs/STANDARDS.md §4).

export { matricesSummary } from './armPanels';
export type { ArmViewerPanel } from './armPanels';
export { translationOf } from './ArmScene';

/** UUID que recibe el `RobotSpec` de un brazo del catálogo; el visor no persiste robots. */
const VIEWER_ROBOT_ID = '00000000-0000-4000-8000-000000000133';

export interface ArmViewerProps {
  /** Brazo del catálogo a cargar (`catalog/arms/{catalogId}`). */
  catalogId?: string;
  /** Brazo ya resuelto; tiene prioridad sobre `catalogId` para el spec. */
  robot?: RobotSpec;
  /** Configuración inicial, en radianes. */
  initialQ?: number[];
  /** Qué capas se muestran; las tres son operativas (F5-01a, F5-02 y F5-03). */
  show: Array<'frames' | 'matrices' | 'workspace'>;
  compact?: boolean;
  /**
   * Envoltorio opcional de los paneles «Articulaciones» y «Efector» (F5-01b, #134). El visor
   * llama a esta función una vez por panel, en ese orden, y pinta lo que devuelve en lugar del
   * panel suelto. Sirve para que la página los pliegue en acordeones en móvil (docs/DESIGN.md
   * §9.4) sin duplicar su contenido. Sin ella el marcado es exactamente el de F5-01a.
   */
  renderPanel?: (panel: ArmViewerPanel) => ReactNode;
}

/** El brazo cargado del catálogo, o `null` mientras se carga o si falla. */
function useCatalogArm(catalogId: string | undefined): {
  robot: URDFRobot | null;
  spec: RobotSpec | null;
  failed: boolean;
} {
  const [state, setState] = useState<{
    robot: URDFRobot | null;
    spec: RobotSpec | null;
    failed: boolean;
  }>({ robot: null, spec: null, failed: false });

  useEffect(() => {
    if (catalogId === undefined) return;
    let active = true;
    loadUrdf(catalogId, { domParser: new DOMParser(), robotId: VIEWER_ROBOT_ID })
      .then((loaded) => {
        if (active) setState({ robot: loaded.robot, spec: loaded.spec, failed: false });
      })
      .catch(() => {
        if (active) setState({ robot: null, spec: null, failed: true });
      });
    return () => {
      active = false;
    };
  }, [catalogId]);

  return state;
}

/** Lo que `ArmViewerReady` necesita, ya resuelto por `ArmViewer`. */
interface ArmViewerReadyProps {
  spec: RobotSpec;
  robot: URDFRobot | null;
  initialQ: number[] | undefined;
  showFrames: boolean;
  showMatrices: boolean;
  showWorkspace: boolean;
  compact: boolean;
  renderPanel: ((panel: ArmViewerPanel) => ReactNode) | undefined;
}

/** El visor con un brazo ya resuelto: escena, sliders y panel del efector. */
function ArmViewerReady({
  spec,
  robot,
  initialQ,
  showFrames,
  showMatrices,
  showWorkspace,
  compact,
  renderPanel,
}: ArmViewerReadyProps): JSX.Element {
  const t = useT();
  const sim = useArmSim(spec, initialQ);
  const [framesVisible, setFramesVisible] = useState(showFrames);
  const { highlighted, onHighlight } = useHighlightedLink();
  const { workspace, onWorkspace } = useWorkspaceCloud();
  const matrices = { show: showMatrices, onHighlight, highlighted };
  const panels = armPanels(sim, t, panelSummaries(sim, t), matrices, {
    show: showWorkspace,
    onChange: onWorkspace,
  });
  return (
    <div
      className={compact ? 'flex flex-col gap-4' : 'flex flex-col gap-5 md:flex-row'}
      data-testid="arm-viewer"
      data-compact={String(compact)}
    >
      <SceneColumn
        spec={spec}
        sim={sim}
        robot={robot}
        framesVisible={framesVisible}
        onFrames={setFramesVisible}
        highlightLink={showMatrices ? (highlighted ?? undefined) : undefined}
        workspace={showWorkspace ? workspace : HIDDEN_WORKSPACE}
      />
      <PanelColumn panels={panels} renderPanel={renderPanel} />
    </div>
  );
}

/**
 * Visor URDF de un brazo serial (docs/WIDGETS.md, ArmViewerWidget). La escena viene de
 * `urdf-loader`; los marcos, los límites y el panel del efector, de sim-core.
 */
export function ArmViewer({
  catalogId,
  robot,
  initialQ,
  show,
  compact = false,
  renderPanel,
}: ArmViewerProps): JSX.Element {
  const t = useT();
  // `catalogId` siempre se carga si viene: es de donde salen la jerarquía y las mallas. `robot`,
  // si se pasa, manda sobre el spec (docs/WIDGETS.md, ArmViewerWidget).
  const loaded = useCatalogArm(catalogId);
  const spec = robot ?? loaded.spec;

  if (spec === null) {
    return (
      <p className="text-fg-muted text-sm" role="status" data-testid="arm-viewer-status">
        {loaded.failed ? t('sims.arm.loadError', { id: catalogId ?? '' }) : t('sims.arm.loading')}
      </p>
    );
  }

  return (
    <ArmViewerReady
      spec={spec}
      robot={loaded.robot}
      initialQ={initialQ}
      showFrames={show.includes('frames')}
      showMatrices={show.includes('matrices')}
      showWorkspace={show.includes('workspace')}
      compact={compact}
      renderPanel={renderPanel}
    />
  );
}
