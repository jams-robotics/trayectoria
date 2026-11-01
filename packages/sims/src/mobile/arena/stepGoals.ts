import type { DiffDriveState } from '@trayectoria/sim-core';

import { CELL_M } from './steps';
import type { Action, Move } from './steps';
import type { FreeLayout } from './freeArena';

// The floor and the two small goals of the «Pasos» mode, checked by themselves like every
// challenge: no teacher needed to say whether the program worked.

export type StepGoal = 'square' | 'star';

const START = { x_m: -0.5, y_m: 0, theta_rad: 0 };
/** The star: four cells ahead and two to the left of the start, past the cones. */
const STAR = { x_m: START.x_m + 4 * CELL_M, y_m: START.y_m + 2 * CELL_M };

/** The floor of «Pasos»: two cones on the grid and, with the star goal, the star. */
export function stepsLayout(goal: StepGoal | null): FreeLayout {
  return {
    halfWidth_m: 1.5,
    halfHeight_m: 1,
    cones: [
      { x_m: 0.25, y_m: 0 },
      { x_m: 0, y_m: -0.5 },
    ],
    goals: goal === 'star' ? [STAR] : [],
    start: START,
  };
}

const LETTER: Record<Move, string> = { forward: 'F', left: 'L', right: 'R' };
const SIDES = 4;
const MAX_SIDE_CELLS = 6;

/** A square: four equal sides of at least one cell, with a turn to the same side after each. */
export function isSquare(actions: readonly Action[]): boolean {
  const word = actions.map((action) => LETTER[action.move]).join('');
  for (let cells = 1; cells <= MAX_SIDE_CELLS; cells += 1) {
    for (const turn of ['L', 'R']) {
      const square = `${'F'.repeat(cells)}${turn}`.repeat(SIDES);
      if (word === square || word === square.slice(0, -1)) return true;
    }
  }
  return false;
}

const BACK_HOME_M = 0.05;
const SAME_HEADING_RAD = 0.1;

/** The robot is back where it started, facing the way it started. */
export function backAtStart(pose: DiffDriveState): boolean {
  const heading = Math.atan2(
    Math.sin(pose.theta_rad - START.theta_rad),
    Math.cos(pose.theta_rad - START.theta_rad),
  );
  return (
    Math.hypot(pose.x_m - START.x_m, pose.y_m - START.y_m) < BACK_HOME_M &&
    Math.abs(heading) < SAME_HEADING_RAD
  );
}

/** Whether the run solved `goal`: the star taken, or a closed square drawn and finished. */
export function goalMet(
  goal: StepGoal | null,
  actions: readonly Action[],
  finished: boolean,
  pose: DiffDriveState,
  starTaken: boolean,
): boolean {
  if (goal === 'star') return starTaken;
  return goal === 'square' && finished && isSquare(actions) && backAtStart(pose);
}
