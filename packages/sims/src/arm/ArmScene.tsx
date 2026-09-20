import { useCallback, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { radToDeg } from '@trayectoria/sim-core';
import type { Mat4 } from '@trayectoria/sim-core';
import { Frame, Scene3D } from '@trayectoria/widgets/scene3d';
import type { URDFRobot } from 'urdf-loader';

import { FramesToggle } from './FramesToggle';
import { UrdfModel } from './UrdfModel';
import type { WorkspaceState } from './workspace/WorkspacePanel';
import { WorkspacePoints } from './workspace/WorkspacePoints';
import { readArmColors } from './armColors';
import type { ActuatedJoint, ArmSim, EffectorReadout } from './useArmSim';

/** Posición del eslabón, en metros, leída de la columna de traslación del `Mat4` de sim-core. */
export function translationOf(transform: Mat4): readonly [number, number, number] {
  // Columna-mayor (sim-core math/mat4.ts): la traslación ocupa los índices 12, 13 y 14.
  return [transform[12] ?? 0, transform[13] ?? 0, transform[14] ?? 0];
}

// La escena 3D del visor y sus hooks de estado (F5-03, #136), separados de `ArmViewer.tsx` para
// que ninguno de los dos archivos pase de 300 líneas (docs/STANDARDS.md §4). Sin API pública
// propia: `ArmViewer.tsx` es el único que importa de aquí.

/** Largo de los brazos de cada tríada de eslabón, en metros. */
const FRAME_LENGTH_M = 0.06;

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

/** Los resúmenes de una línea de los dos paneles fijos, para plegarlos en móvil. */
export function panelSummaries(sim: ArmSim, t: Translate): { joints: string; effector: string } {
  return {
    joints: jointsSummary(sim.joints, sim.q_rad, t('sims.arm.unitDeg')),
    effector: effectorPanelSummary(sim.readout, t),
  };
}

/** Sin `show: ['workspace']` no hay nube que dibujar. */
export const HIDDEN_WORKSPACE: WorkspaceState = { points: null, visible: false };

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
export function useHighlightedLink(): {
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
export function useWorkspaceCloud(): {
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
export function SceneColumn({
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
