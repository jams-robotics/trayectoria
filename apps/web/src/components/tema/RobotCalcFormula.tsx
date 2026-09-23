import type { JSX } from 'react';
import { useMyRobot } from '@trayectoria/widgets/MyRobotWidget';

import { findRobotCalc } from '../../lib/robotCalcs';
import { TopicWidget } from './TopicWidget';

/**
 * Island of `RobotFormula.astro`: resolves the calc by its key, runs it on «Mi robot» and renders
 * the substituted `Formula` (#243, decision 3). It receives the key, not the calc, because a
 * function does not survive the JSON serialization of island props; the registry is the same
 * module the `.astro` already checked at build time.
 *
 * `useMyRobot()` re-renders the island whenever the learner saves a new robot, so the numbers
 * follow the profile with no reload.
 */
export interface RobotCalcFormulaProps {
  /** Registry key of the calc: `<topicId>/<calcId>`. */
  readonly calc: string;
}

export function RobotCalcFormula({ calc }: RobotCalcFormulaProps): JSX.Element {
  const robot = useMyRobot();
  const robotCalc = findRobotCalc(calc);
  if (robotCalc === undefined) {
    // `RobotFormula.astro` already failed the build for an unknown key; this only narrows the type.
    throw new Error(`unknown robot calc "${calc}" (components/tema/RobotCalcFormula)`);
  }
  const { latex, substituted } = robotCalc.compute(robot);
  return <TopicWidget name="Formula" props={{ block: true, latex, substituted }} />;
}
