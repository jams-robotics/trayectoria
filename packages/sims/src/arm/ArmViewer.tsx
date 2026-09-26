import { useEffect, useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { RobotSpec } from '@trayectoria/robot-spec';
import type { URDFRobot } from 'urdf-loader';

import { ArmColumns } from './armLayout';
import { PanelColumn, armPanels } from './armPanels';
import type { ArmViewerPanel } from './armPanels';
import {
  HIDDEN_WORKSPACE,
  SceneColumn,
  panelSummaries,
  useHighlightedLink,
  useWorkspaceCloud,
} from './ArmScene';
import { loadArm } from './loadUrdf';
import type { ArmSource } from './loadUrdf';
import { useArmSim } from './useArmSim';

// F5-01a (#133): URDF viewer with the props of `ArmViewerWidget` (docs/WIDGETS.md). `show` accepts
// the three catalog options; `'frames'` is from F5-01a and `'matrices'` from F5-02 (#135,
// decisions 4 and 5). The workspace is still F5-03. The 3D scene and its state
// hooks live in `ArmScene.tsx`, and the panel column in `armPanels.tsx`, split since
// F5-03 (#136) so that no file exceeds 300 lines (docs/STANDARDS.md §4).

export { matricesSummary } from './armPanels';
export type { ArmViewerPanel } from './armPanels';
export { translationOf } from './ArmScene';

/** UUID given to the `RobotSpec` of a catalog arm; the viewer does not persist robots. */
const VIEWER_ROBOT_ID = '00000000-0000-4000-8000-000000000133';

export interface ArmViewerProps {
  /** Catalog arm to load (`catalog/arms/{catalogId}`). */
  catalogId?: string;
  /**
   * Source of the arm when it is not the catalog (F5-04, #137, decision 2): a zip already in memory.
   * When given, it takes precedence over `catalogId`.
   */
  source?: ArmSource;
  /** Already resolved arm; takes priority over `catalogId` for the spec. */
  robot?: RobotSpec;
  /** Initial configuration, in radians. */
  initialQ?: number[];
  /** Which layers are shown; all three are operational (F5-01a, F5-02 and F5-03). */
  show: Array<'frames' | 'matrices' | 'workspace'>;
  compact?: boolean;
  /**
   * Optional wrapper for the «Articulaciones» and «Efector» panels (F5-01b, #134). The viewer
   * calls this function once per panel, in that order, and renders what it returns instead of the
   * bare panel. It lets the page collapse them into accordions on mobile (docs/DESIGN.md
   * §9.4) without duplicating their content. Without it the markup is exactly that of F5-01a.
   */
  renderPanel?: (panel: ArmViewerPanel) => ReactNode;
}

/**
 * The arm loaded from its source, or `null` while loading or if it fails. The object URLs of an
 * imported arm are revoked when the source changes and on unmount (#137, decision 2), so none
 * is ever left alive once the viewer stops drawing that zip.
 */
function useLoadedArm(source: ArmSource | undefined): {
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
    if (source === undefined) return;
    let active = true;
    let release: (() => void) | null = null;
    loadArm(source, { domParser: new DOMParser(), robotId: VIEWER_ROBOT_ID })
      .then((loaded) => {
        if (!active) {
          loaded.revoke();
          return;
        }
        release = loaded.revoke;
        setState({ robot: loaded.robot, spec: loaded.spec, failed: false });
      })
      .catch(() => {
        if (active) setState({ robot: null, spec: null, failed: true });
      });
    return () => {
      active = false;
      release?.();
    };
  }, [source]);

  return state;
}

/** What `ArmViewerReady` needs, already resolved by `ArmViewer`. */
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

/** The viewer with an already resolved arm: scene, sliders and effector panel. */
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
  const scene = (
    <SceneColumn
      spec={spec}
      sim={sim}
      robot={robot}
      framesVisible={framesVisible}
      onFrames={setFramesVisible}
      highlightLink={showMatrices ? (highlighted ?? undefined) : undefined}
      workspace={showWorkspace ? workspace : HIDDEN_WORKSPACE}
    />
  );
  // #375: the full viewer is the simulator page's layout (sticky left column).
  if (!compact) return <ArmColumns scene={scene} panels={panels} renderPanel={renderPanel} />;
  return (
    <div className="flex flex-col gap-4" data-testid="arm-viewer" data-compact="true">
      {scene}
      <PanelColumn panels={panels} renderPanel={renderPanel} />
    </div>
  );
}

/**
 * URDF viewer of a serial arm (docs/WIDGETS.md, ArmViewerWidget). The scene comes from
 * `urdf-loader`; the frames, the limits and the effector panel, from sim-core.
 */
export function ArmViewer({
  catalogId,
  source,
  robot,
  initialQ,
  show,
  compact = false,
  renderPanel,
}: ArmViewerProps): JSX.Element {
  const t = useT();
  // The source is always loaded when given: it is where the hierarchy and the meshes come from.
  // `robot`, if passed, takes precedence for the spec (docs/WIDGETS.md, ArmViewerWidget).
  const armSource = useMemo(
    (): ArmSource | undefined =>
      source ?? (catalogId === undefined ? undefined : { kind: 'catalog', catalogId }),
    [source, catalogId],
  );
  const loaded = useLoadedArm(armSource);
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
