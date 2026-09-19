export { MyRobotWidget } from './MyRobotWidget';
export type { MyRobotWidgetProps } from './MyRobotWidget';
export { useMyRobot } from './useMyRobot';
export {
  configureMyRobotPersistence,
  parseStoredRobot,
  referenceRobot,
  robotSpecToJson,
  resetMyRobot,
  setMyRobot,
} from '../stores/myRobot';
export type { RobotPersistence, SaveResult } from '../stores/myRobot';
// Re-exported so a consumer can type a spec without depending on robot-spec directly.
export type { RobotSpec } from '@trayectoria/robot-spec';
