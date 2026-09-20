import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { radToDeg } from '@trayectoria/sim-core';
import type { Mat4 } from '@trayectoria/sim-core';
import { Frame, Scene3D } from '@trayectoria/widgets/scene3d';
import type { URDFRobot } from 'urdf-loader';

import { FramesToggle } from './FramesToggle';
import { PanelColumn, armPanels } from './armPanels';
import type { ArmViewerPanel } from './armPanels';
import { UrdfModel } from './UrdfModel';
import type { WorkspaceState } from './workspace/WorkspacePanel';
import { WorkspacePoints } from './workspace/WorkspacePoints';
import { readArmColors } from './armColors';
import { loadUrdf } from './loadUrdf';
import { useArmSim } from './useArmSim';
import type { ActuatedJoint, ArmSim, EffectorReadout } from './useArmSim';

// F5-01a (#133): visor URDF con las props de `ArmViewerWidget` (docs/WIDGETS.md). `show` acepta
// las tres opciones del catálogo; `'frames'` es de F5-01a y `'matrices'` de F5-02 (#135,
// decisiones 4 y 5). El espacio de trabajo sigue siendo F5-03.

export { matricesSummary } from './armPanels';
export type { ArmViewerPanel } from './armPanels';

/** Largo de los brazos de cada tríada de eslabón, en metros. */
const FRAME_LENGTH_M = 0.06;

/** UUID que recibe el `RobotSpec` de un brazo del catálogo; el visor no persiste robots. */
const VIEWER_ROBOT_ID = '00000000-0000-4000-8000-000000000133';

/** Posición del eslabón, en metros, leída de la columna de traslación del `Mat4` de sim-core. */
export function translationOf(transform: Mat4): readonly [number, number, number] {
  // Columna-mayor (sim-core math/mat4.ts): la traslación ocupa los índices 12, 13 y 14.
  return [transform[12] ?? 0, transform[13] ?? 0, transform[14] ?? 0];
}

/** Decimales del resumen de las articulaciones, en grados (mismo formato que el panel del efector). */
const JOINT_SUMMARY_DECIMALS = 1;

/** Resumen de una línea de las articulaciones: `joint1 90.0° · joint2 0.0°`. */
export function jointsSummary(
  joints: readonly ActuatedJoint[],
  q_rad: readonly number[],
  unit_deg: string,
): string {
  return joints
    .map(
      (joint, index) =>
        `${joint.name} ${radToDeg(q_rad[index] ?? 0).toFixed(JOINT_SUMMARY_DECIMALS)}${unit_deg}`,
    )
    .join(' · ');
}

/** Resumen de una línea del efector: `x 0.000 y 0.350 z 0.000 m`. */
export function effectorPanelSummary(readout: EffectorReadout, t: Translate): string {
  const axes = [
    [t('sims.arm.x'), readout.x_m],
    [t('sims.arm.y'), readout.y_m],
    [t('sims.arm.z'), readout.z_m],
  ]
    .map(([label, value]) => `${label} ${value}`)
    .join(' ');
  return `${axes} ${t('sims.arm.unitM')}`;
}

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

/** Las tríadas de los eslabones, colocadas con `forwardKinematics` de sim-core (nunca con three). */
function LinkFrames({ transforms }: { transforms: ReadonlyMap<string, Mat4> }): JSX.Element {
  return (
    <>
      {[...transforms].map(([link, transform]) => (
        <Frame key={link} position_m={translationOf(transform)} length_m={FRAME_LENGTH_M} />
      ))}
    </>
  );
}

/** La escena del visor: el brazo de three y, si están activos, los marcos de los eslabones. */
function ArmScene({
  spec,
  sim,
  robot,
  framesVisible,
  highlightLink,
  workspace,
}: {
  spec: RobotSpec;
  sim: ArmSim;
  robot: URDFRobot | null;
  framesVisible: boolean;
  highlightLink: string | undefined;
  workspace: WorkspaceState;
}): JSX.Element {
  const t = useT();
  const colors = useMemo(
    () => readArmColors(typeof document === 'undefined' ? null : document.documentElement),
    [],
  );
  return (
    <Scene3D description={t('sims.arm.scene', { name: spec.name })}>
      {robot === null ? null : (
        <UrdfModel
          robot={robot}
          joints={sim.joints}
          q_rad={sim.q_rad}
          baseLink={sim.arm.baseLink}
          colors={colors}
          highlightLink={highlightLink}
        />
      )}
      {framesVisible ? <LinkFrames transforms={sim.linkTransforms} /> : null}
      {workspace.points === null ? null : (
        <WorkspacePoints points={workspace.points} visible={workspace.visible} />
      )}
    </Scene3D>
  );
}

/** El eslabón elegido en el panel de matrices, que es el que se marca en 3D (#135, decisión 4). */
function useHighlightedLink(): {
  highlighted: string | null;
  onHighlight: (link: string | null) => void;
} {
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const onHighlight = useCallback((link: string | null): void => {
    setHighlighted(link);
  }, []);
  return { highlighted, onHighlight };
}

/** La nube del espacio de trabajo la calcula el panel; aquí solo se guarda para la escena. */
function useWorkspaceCloud(): {
  workspace: WorkspaceState;
  onWorkspace: (state: WorkspaceState) => void;
} {
  const [workspace, setWorkspace] = useState<WorkspaceState>({ points: null, visible: true });
  const onWorkspace = useCallback((state: WorkspaceState): void => {
    setWorkspace(state);
  }, []);
  return { workspace, onWorkspace };
}

/** La columna del visor: el toggle de marcos sobre la escena 3D. */
function SceneColumn({
  spec,
  sim,
  robot,
  framesVisible,
  onFrames,
  highlightLink,
  workspace,
}: {
  spec: RobotSpec;
  sim: ArmSim;
  robot: URDFRobot | null;
  framesVisible: boolean;
  onFrames: (visible: boolean) => void;
  highlightLink: string | undefined;
  workspace: WorkspaceState;
}): JSX.Element {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-3">
        <FramesToggle visible={framesVisible} onToggle={onFrames} />
      </div>
      <ArmScene
        spec={spec}
        sim={sim}
        robot={robot}
        framesVisible={framesVisible}
        highlightLink={highlightLink}
        workspace={workspace}
      />
    </div>
  );
}

/** Los resúmenes de una línea de los dos paneles fijos, para plegarlos en móvil. */
function panelSummaries(sim: ArmSim, t: Translate): { joints: string; effector: string } {
  return {
    joints: jointsSummary(sim.joints, sim.q_rad, t('sims.arm.unitDeg')),
    effector: effectorPanelSummary(sim.readout, t),
  };
}

/** Sin `show: ['workspace']` no hay nube que dibujar. */
const HIDDEN_WORKSPACE: WorkspaceState = { points: null, visible: false };

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
