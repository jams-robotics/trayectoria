// Entrada separada `@trayectoria/sims/arm` (#133, decisión 2; docs/ARCHITECTURE.md §8: `three`
// solo en páginas 3D). El barrel del paquete, `src/index.ts`, no reexporta nada de aquí.
export { ArmViewer, matricesSummary, translationOf } from './ArmViewer';
export type { ArmViewerPanel, ArmViewerProps } from './ArmViewer';
export { EffectorPanel, effectorRows, effectorSummary } from './EffectorPanel';
export type { EffectorPanelProps } from './EffectorPanel';
export { FramesToggle } from './FramesToggle';
export type { FramesToggleProps } from './FramesToggle';
export { JointSliders, jointParams } from './JointSliders';
export type { JointSlidersProps } from './JointSliders';
export { MatrixBlock } from './MatrixBlock';
export type { MatrixBlockProps } from './MatrixBlock';
export { MatrixPanel, chainLatex, matrixLabel } from './MatrixPanel';
export type { MatrixKind, MatrixPanelProps } from './MatrixPanel';
export { UrdfModel, applyArmMaterials, applyHighlight } from './UrdfModel';
export type { UrdfModelProps } from './UrdfModel';
export { ARM_TOKENS, armToken, readArmColors } from './armColors';
export {
  N_DEFAULT,
  N_MAX,
  N_MIN,
  N_STEP,
  WorkspacePanel,
  clampCount,
} from './workspace/WorkspacePanel';
export type { WorkspacePanelProps, WorkspaceState } from './workspace/WorkspacePanel';
export { WorkspacePoints } from './workspace/WorkspacePoints';
export type { WorkspacePointsProps } from './workspace/WorkspacePoints';
export {
  WORKSPACE_TOKENS,
  colorFor,
  distanceToBase_m,
  pointColors,
  readWorkspacePalette,
} from './workspace/colors';
export type { Rgb, WorkspacePalette } from './workspace/colors';
export {
  CANCELLED_REASON,
  WORKSPACE_SEED,
  defaultBatchSize,
  defaultSchedule,
  sampleWorkspaceInBatches,
} from './workspace/sampler';
export type { BatchOptions, BatchSchedule, BatchedSampling } from './workspace/sampler';
export { formatEntry, linkTransforms, matrixRows } from './matrices';
export type { LinkTransform } from './matrices';
export {
  MISSING_MESH_KEY,
  UNSUPPORTED_MESH_KEY,
  catalogBaseUrl,
  catalogUrdfUrl,
  createLoader,
  loadArm,
  loadMesh,
  loadUrdf,
  meshLoaderForZip,
  resolveZipMesh,
  urdfPathOf,
} from './loadUrdf';
export type { ArmSource, LoadUrdfOptions, LoadedArm } from './loadUrdf';
export {
  CONTINUOUS_LIMIT_RAD,
  actuatedJoints,
  armOf,
  clampToLimits,
  formatPose,
  initialConfiguration,
  useArmSim,
} from './useArmSim';
export type { ActuatedJoint, ArmColors, ArmSim, EffectorReadout } from './types';
