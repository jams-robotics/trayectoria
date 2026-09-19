// Entrada separada `@trayectoria/sims/arm` (#133, decisión 2; docs/ARCHITECTURE.md §8: `three`
// solo en páginas 3D). El barrel del paquete, `src/index.ts`, no reexporta nada de aquí.
export { ArmViewer, translationOf } from './ArmViewer';
export type { ArmViewerProps } from './ArmViewer';
export { EffectorPanel, effectorRows, effectorSummary } from './EffectorPanel';
export type { EffectorPanelProps } from './EffectorPanel';
export { FramesToggle } from './FramesToggle';
export type { FramesToggleProps } from './FramesToggle';
export { JointSliders, jointParams } from './JointSliders';
export type { JointSlidersProps } from './JointSliders';
export { UrdfModel, applyArmMaterials } from './UrdfModel';
export type { UrdfModelProps } from './UrdfModel';
export { ARM_TOKENS, armToken, readArmColors } from './armColors';
export {
  UNSUPPORTED_MESH_KEY,
  catalogBaseUrl,
  catalogUrdfUrl,
  createLoader,
  loadMesh,
  loadUrdf,
} from './loadUrdf';
export type { LoadUrdfOptions, LoadedArm } from './loadUrdf';
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
