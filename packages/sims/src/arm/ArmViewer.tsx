import { useEffect, useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { RobotSpec } from '@trayectoria/robot-spec';
import type { Vec3_m } from '@trayectoria/widgets/scene3d';
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
import type { SceneCamera } from './ArmScene';
import { NO_LABELS } from './ficha';
import type { ArmFicha } from './ficha';
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
  /**
   * Whether the viewer draws its own «Marcos» button (default `true`). With `false` the frames
   * follow `show` and the page composes the button in its view group (#537).
   */
  framesToggle?: boolean;
  /** Camera offset from the orbit target to start from, in metres: the zoom kept across arms (#556). */
  cameraOffset_m?: Vec3_m | undefined;
  /** Reports the camera offset each time the user orbits or zooms, to keep it across arms (#556). */
  onCameraChange?: ((offset_m: Vec3_m) => void) | undefined;
}

/** The arm as `useLoadedArm` holds it: nothing while loading or after a failure. */
interface LoadedState {
  robot: URDFRobot | null;
  spec: RobotSpec | null;
  ficha: ArmFicha | null;
  failed: boolean;
}

/**
 * The arm loaded from its source, or `null` while loading or if it fails. The object URLs of an
 * imported arm are revoked when the source changes and on unmount (#137, decision 2), so none
 * is ever left alive once the viewer stops drawing that zip.
 */
function useLoadedArm(source: ArmSource | undefined): LoadedState {
  const [state, setState] = useState<LoadedState>({
    robot: null,
    spec: null,
    ficha: null,
    failed: false,
  });

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
        setState({ robot: loaded.robot, spec: loaded.spec, ficha: loaded.ficha, failed: false });
      })
      .catch(() => {
        if (active) setState({ robot: null, spec: null, ficha: null, failed: true });
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
  ficha: ArmFicha | null;
  initialQ: number[] | undefined;
  showFrames: boolean;
  showMatrices: boolean;
  showWorkspace: boolean;
  compact: boolean;
  renderPanel: ((panel: ArmViewerPanel) => ReactNode) | undefined;
  framesToggle: boolean;
  camera: SceneCamera;
}

/**
 * Visibility of the frames: the viewer's own button governs it, or, without the button, `show`
 * does, because the page owns «Marcos» in its view group (#537).
 */
function useFrames(
  showFrames: boolean,
  framesToggle: boolean,
): { visible: boolean; onFrames: ((visible: boolean) => void) | undefined } {
  const [own, setOwn] = useState(showFrames);
  if (!framesToggle) return { visible: showFrames, onFrames: undefined };
  return { visible: own, onFrames: setOwn };
}

/** The viewer with an already resolved arm: scene, sliders and effector panel. */
function ArmViewerReady(props: ArmViewerReadyProps): JSX.Element {
  const { spec, robot, ficha, showMatrices, showWorkspace, compact, renderPanel } = props;
  const t = useT();
  const sim = useArmSim(spec, props.initialQ);
  const frames = useFrames(props.showFrames, props.framesToggle);
  const { highlighted, onHighlight } = useHighlightedLink();
  const { workspace, onWorkspace } = useWorkspaceCloud();
  const labels = ficha?.labels ?? NO_LABELS;
  const matrices = { show: showMatrices, onHighlight, highlighted };
  const panels = armPanels(
    sim,
    t,
    panelSummaries(sim, t, labels.joints),
    matrices,
    { show: showWorkspace, onChange: onWorkspace },
    labels,
  );
  const scene = (
    <SceneColumn
      spec={spec}
      sim={sim}
      robot={robot}
      framesVisible={frames.visible}
      onFrames={frames.onFrames}
      highlightLink={showMatrices ? (highlighted ?? undefined) : undefined}
      workspace={showWorkspace ? workspace : HIDDEN_WORKSPACE}
      camera={props.camera}
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
 * Where the arm comes from: the given source or, without it, the catalog arm `catalogId`. It is
 * always loaded when there is one: it is where the hierarchy and the meshes come from.
 */
function useArmSource(
  source: ArmSource | undefined,
  catalogId: string | undefined,
): ArmSource | undefined {
  return useMemo(
    (): ArmSource | undefined =>
      source ?? (catalogId === undefined ? undefined : { kind: 'catalog', catalogId }),
    [source, catalogId],
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
  framesToggle = true,
  cameraOffset_m,
  onCameraChange,
}: ArmViewerProps): JSX.Element {
  const t = useT();
  const loaded = useLoadedArm(useArmSource(source, catalogId));
  // `robot`, if passed, takes precedence for the spec (docs/WIDGETS.md, ArmViewerWidget).
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
      ficha={loaded.ficha}
      initialQ={initialQ}
      showFrames={show.includes('frames')}
      showMatrices={show.includes('matrices')}
      showWorkspace={show.includes('workspace')}
      compact={compact}
      renderPanel={renderPanel}
      framesToggle={framesToggle}
      camera={{ offset_m: cameraOffset_m, onChange: onCameraChange }}
    />
  );
}
