import { describe, expect, test } from 'vitest';
import { parseRobotSpec, referenceMobile } from '@trayectoria/robot-spec';
import type { MobileSpec } from '@trayectoria/robot-spec';

import { createFreeRace } from './freeRace';
import { backAtStart, isSquare, stepsLayout } from './stepGoals';
import { createStepRunner } from './stepRunner';
import { MAX_STEPS, addStep, canAdd, expand } from './steps';
import type { Program, Step } from './steps';

const F: Step = { kind: 'forward' };
const L: Step = { kind: 'left' };
const R: Step = { kind: 'right' };
const end: Step = { kind: 'end' };
const times = (n: number): Step => ({ kind: 'repeat', n });

function build(...steps: Step[]): Program {
  return steps.reduce<Program>(addStep, []);
}

function robotSpec(): MobileSpec {
  const result = parseRobotSpec(referenceMobile);
  if (!result.ok || result.value.mobile === undefined) throw new Error('reference does not parse');
  return result.value.mobile;
}

/** Runs `program` on the real model until the runner stops; returns the race and the runner. */
function execute(program: Program, goal: 'square' | 'star' | null = null) {
  const result = parseRobotSpec(referenceMobile);
  if (!result.ok) throw new Error('reference does not parse');
  const layout = stepsLayout(goal);
  const race = createFreeRace(result.value, layout);
  const runner = createStepRunner(robotSpec(), layout.start, expand(program));
  race.setDriver((pose, bumped) => runner.drive(pose, bumped));
  for (
    let i = 0;
    i < 1200 && runner.status().state === 'running' && race.finished_s === null;
    i += 1
  )
    race.advance(0.1);
  return { race, runner };
}

describe('expand', () => {
  test('repeat runs its block n times and keeps the button each move came from', () => {
    const actions = expand(build(F, times(3), L, F, end, R));
    expect(actions.map((a) => a.move).join()).toBe(
      'forward,left,forward,left,forward,left,forward,right',
    );
    expect(actions.map((a) => a.index)).toEqual([0, 2, 3, 2, 3, 2, 3, 5]);
  });

  test('a block left open runs up to the end', () => {
    expect(expand(build(times(2), F))).toHaveLength(2);
  });
});

describe('addStep', () => {
  test('stops at the limit of buttons', () => {
    const full = build(...Array.from({ length: MAX_STEPS + 5 }, () => F));
    expect(full).toHaveLength(MAX_STEPS);
    expect(canAdd(full, F)).toBe(false);
  });

  test('allows one level of repeat and an end only inside it', () => {
    expect(canAdd(build(F), end)).toBe(false);
    expect(canAdd(build(times(2)), times(2))).toBe(false);
    expect(canAdd(build(times(2), end), times(3))).toBe(true);
    expect(canAdd([], times(1))).toBe(false);
    expect(canAdd([], times(10))).toBe(false);
  });
});

describe('the step runner on the real model', () => {
  test('a quarter turn ends within 3 degrees', () => {
    const { race, runner } = execute(build(L));
    expect(runner.status().state).toBe('done');
    const error = Math.abs(race.you.state.robot.theta_rad - Math.PI / 2);
    expect(error).toBeLessThan((3 * Math.PI) / 180);
  });

  test('forward moves one cell', () => {
    const { race } = execute(build(F));
    expect(race.you.state.robot.x_m - stepsLayout(null).start.x_m).toBeCloseTo(0.25, 1);
  });

  test('forward, left four times with repeat draws a square and returns to the start', () => {
    const { race, runner } = execute(build(times(4), F, F, L, end));
    expect(runner.status().state).toBe('done');
    expect(isSquare(expand(build(times(4), F, F, L, end)))).toBe(true);
    expect(backAtStart(race.you.state.robot)).toBe(true);
  });

  test('stops at the cone and says where', () => {
    const { runner } = execute(build(F, F, F, F));
    expect(runner.status()).toEqual({ state: 'blocked', index: 2 });
  });

  test('the star is reached going around the cone', () => {
    const { race, runner } = execute(build(L, F, F, R, F, F, F, F), 'star');
    // The run ends the moment the star is taken, before the last move is done.
    expect(race.finished_s).not.toBeNull();
    expect(runner.status().state).toBe('running');
  });
});

describe('isSquare', () => {
  test('rejects a rectangle and an open path', () => {
    expect(isSquare(expand(build(F, F, L, F, L, F, F, L, F, L)))).toBe(false);
    expect(isSquare(expand(build(F, L, F, L, F)))).toBe(false);
  });
});
