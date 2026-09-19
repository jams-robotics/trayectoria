export { MyRobotWidget } from './MyRobotWidget';
export type { MyRobotMode, MyRobotWidgetProps } from './MyRobotWidget';
export { RobotCard, cardItems } from './card';
export {
  ALL_FIELDS,
  FIELD_GROUPS,
  draftOf,
  omegaMax_radps,
  parseCell,
  specFromDraft,
  vMax_mps,
} from './fields';
export type { RobotDraft, RobotField, RobotFieldGroup } from './fields';
export { FieldRow, labelKey } from './rows';
export { useMyRobotForm } from './state';
export type { FieldErrors, FormNotice, MyRobotFormState } from './state';
export { useMyRobot } from './useMyRobot';
export {
  MY_ROBOT_STORAGE_KEY,
  $myRobot,
  configureMyRobotPersistence,
  parseStoredRobot,
  readStoredRobot,
  referenceRobot,
  resetMyRobot,
  setMyRobot,
} from '../stores/myRobot';
export type { RobotPersistence, SaveResult } from '../stores/myRobot';
// Re-exported so a consumer can type a spec without depending on robot-spec directly.
export type { RobotSpec } from '@trayectoria/robot-spec';
