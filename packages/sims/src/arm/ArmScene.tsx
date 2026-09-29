import { useCallback, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { RobotSpec } from '@trayectoria/robot-spec';
import { radToDeg } from '@trayectoria/sim-core';
import type { Mat4 } from '@trayectoria/sim-core';
import { Frame, Scene3D } from '@trayectoria/widgets/scene3d';
import type { CameraPosition_m } from '@trayectoria/widgets/scene3d';
import type { URDFRobot } from 'urdf-loader';

import { labelOf } from './ficha';
import { FramesToggle } from './FramesToggle';
import { UrdfModel } from './UrdfModel';
import type { WorkspaceState } from './workspace/WorkspacePanel';
import { WorkspacePoints } from './workspace/WorkspacePoints';
import { readArmColors } from './armColors';
import type { ActuatedJoint, ArmSim, EffectorReadout } from './useArmSim';

/** Position of the link, in metres, read from the translation column of the sim-core `Mat4`. */
export function translationOf(transform: Mat4): readonly [number, number, number] {
  // Column-major (sim-core math/mat4.ts): the translation occupies indices 12, 13 and 14.
  return [transform[12] ?? 0, transform[13] ?? 0, transform[14] ?? 0];
}

// The 3D scene of the viewer and its state hooks (F5-03, #136), split from `ArmViewer.tsx` so
// that neither file exceeds 300 lines (docs/STANDARDS.md §4). No public API of its
// own: `ArmViewer.tsx` is the only one that imports from here.

/** Length of the arms of each link triad, in metres. */
const FRAME_LENGTH_M = 0.06;

/** Decimals of the joint summary, in degrees (same format as the effector panel). */
const JOINT_SUMMARY_DECIMALS = 1;

/** Labels of an arm without a catalog card: the summary uses the URDF names. */
const NO_JOINT_LABELS: ReadonlyMap<string, string> = new Map();

/**
 * One-line summary of the joints: `joint1 90.0° · joint2 0.0°`, with the readable name of the
 * card instead of the URDF one when it has it (#535).
 */
export function jointsSummary(
  joints: readonly ActuatedJoint[],
  q_rad: readonly number[],
  unit_deg: string,
  labels: ReadonlyMap<string, string> = NO_JOINT_LABELS,
): string {
  return joints
    .map((joint, index) => {
      const angle = radToDeg(q_rad[index] ?? 0).toFixed(JOINT_SUMMARY_DECIMALS);
      return `${labelOf(labels, joint.name)} ${angle}${unit_deg}`;
    })
    .join(' · ');
}

/** One-line summary of the effector: `x 0.000 y 0.350 z 0.000 m`. */
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

/** The one-line summaries of the two fixed panels, to collapse them on mobile. */
export function panelSummaries(
  sim: ArmSim,
  t: Translate,
  jointLabels?: ReadonlyMap<string, string>,
): { joints: string; effector: string } {
  return {
    joints: jointsSummary(sim.joints, sim.q_rad, t('sims.arm.unitDeg'), jointLabels),
    effector: effectorPanelSummary(sim.readout, t),
  };
}

/** Without `show: ['workspace']` there is no cloud to draw. */
export const HIDDEN_WORKSPACE: WorkspaceState = { points: null, visible: false };

/** The link triads, placed with sim-core `forwardKinematics` (never with three). */
function LinkFrames({ transforms }: { transforms: ReadonlyMap<string, Mat4> }): JSX.Element {
  return (
    <>
      {[...transforms].map(([link, transform]) => (
        <Frame key={link} position_m={translationOf(transform)} length_m={FRAME_LENGTH_M} />
      ))}
    </>
  );
}

/**
 * Where the scene camera starts (#556): the reach of the card frames it, and the position the
 * user left on the previous arm, when there is one, wins over it.
 */
export interface SceneCamera {
  readonly frameRadius_m: number | undefined;
  readonly position_m: CameraPosition_m | undefined;
  readonly onChange: ((position_m: CameraPosition_m) => void) | undefined;
}

/** What the scene draws: the arm, its frames, the workspace cloud and where the camera starts. */
interface ArmSceneProps {
  spec: RobotSpec;
  sim: ArmSim;
  robot: URDFRobot | null;
  framesVisible: boolean;
  highlightLink: string | undefined;
  workspace: WorkspaceState;
  camera: SceneCamera;
}

/** The viewer scene: the three arm and, when enabled, the link frames. */
function ArmScene({
  spec,
  sim,
  robot,
  framesVisible,
  highlightLink,
  workspace,
  camera,
}: ArmSceneProps): JSX.Element {
  const t = useT();
  const colors = useMemo(
    () => readArmColors(typeof document === 'undefined' ? null : document.documentElement),
    [],
  );
  return (
    <Scene3D
      description={t('sims.arm.scene', { name: spec.name })}
      frameRadius_m={camera.frameRadius_m}
      cameraPosition_m={camera.position_m}
      onCameraChange={camera.onChange}
    >
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

/** The link chosen in the matrix panel, which is the one highlighted in 3D (#135, decision 4). */
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

/** The workspace cloud is computed by the panel; here it is only stored for the scene. */
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

/**
 * The viewer column: the frames toggle over the 3D scene. Without `onFrames` there is no toggle:
 * the page composes «Marcos» in its own view group (#537).
 */
export function SceneColumn({
  onFrames,
  ...scene
}: ArmSceneProps & { onFrames: ((visible: boolean) => void) | undefined }): JSX.Element {
  return (
    <div className="min-w-0 flex-1">
      {onFrames === undefined ? null : (
        <div className="mb-3">
          <FramesToggle visible={scene.framesVisible} onToggle={onFrames} />
        </div>
      )}
      <ArmScene {...scene} />
    </div>
  );
}
