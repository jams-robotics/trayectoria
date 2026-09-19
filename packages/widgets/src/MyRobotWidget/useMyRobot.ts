import { useStore } from '@nanostores/react';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { $myRobot } from '../stores/myRobot';

/**
 * «Mi robot» for a React island: always a valid `RobotSpec`, and re-rendered whenever the
 * learner saves a new one (#95, decision 6). Every widget that needs a robot reads it from
 * here instead of holding the reference example.
 */
export function useMyRobot(): RobotSpec {
  return useStore($myRobot);
}
