import { useEffect } from 'react';
import { useStore } from '@nanostores/react';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { $myRobot, hydrateMyRobot } from '../stores/myRobot';

/**
 * «Mi robot» for a React island: always a valid `RobotSpec`, and re-rendered whenever the
 * learner saves a new one (#95, decision 6). Every widget that needs a robot reads it from
 * here instead of holding the reference example.
 *
 * The first render returns the reference robot, the same one the server rendered; the effect
 * then adopts the robot stored in this browser, after hydration (docs/audits F2-01a).
 */
export function useMyRobot(): RobotSpec {
  useEffect(hydrateMyRobot, []);
  return useStore($myRobot);
}
