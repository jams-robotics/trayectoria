export { DiffDriveWidget } from './DiffDriveWidget';
export type { DiffDriveWidgetProps, DiffDriveMode, DiffDriveShow } from './DiffDriveWidget';
export {
  defaultRobot,
  headingTo,
  icrOf,
  isFeasible,
  maxSpeed_mps,
  mobileOf,
  rotationMatrix,
  saturate,
  toGlobal,
  toRobot,
  turningRadius_m,
  wheelCentres,
  wheelSpeed_mps,
} from './compute';
export type { Pose } from './compute';
export { frameRows, poseRows, radiusText, readDiffDrive, statusOf } from './rows';
export type { Readout } from './rows';
export { INITIAL_POSE, DT_S } from './timeline';
