import { describe, expect, test } from 'vitest';
import { parseRobotSpec, referenceMobile } from '@trayectoria/robot-spec';

import { FREE_LAYOUT, ROBOT_RADIUS_M } from './freeArena';
import { createFreeRace, freeProgress } from './freeRace';

function run(command: { omegaL_radps: number; omegaR_radps: number } | null, seconds: number) {
  const result = parseRobotSpec(referenceMobile);
  if (!result.ok) throw new Error('reference robot does not parse');
  const race = createFreeRace(result.value, FREE_LAYOUT);
  race.setCommand(command);
  for (let i = 0; i < seconds * 10; i += 1) race.advance(0.1);
  return race;
}

describe('createFreeRace', () => {
  test('driving straight collects the goal on the way and stops at the wall, never derailing', () => {
    const race = run({ omegaL_radps: 10, omegaR_radps: 10 }, 12);
    expect(race.collected[2]).toBe(true);
    expect(race.you.state.robot.x_m).toBeCloseTo(FREE_LAYOUT.halfWidth_m - ROBOT_RADIUS_M, 3);
    expect(race.you.derailed).toBe(false);
    expect(race.finished_s).toBeNull();
  });

  test('stays put while no command is given, and reports its progress', () => {
    const race = run({ omegaL_radps: 0, omegaR_radps: 0 }, 1);
    expect(race.you.state.robot.x_m).toBeCloseTo(FREE_LAYOUT.start.x_m, 6);
    // The stopwatch waits for the first move.
    expect(freeProgress(race)).toMatchObject({ collected: 0, total: 5, done: false, time_s: 0 });
  });

  test('stays put with no command at all, as in «Pasos» before «Ejecutar»', () => {
    const race = run(null, 1);
    expect(race.you.state.robot.x_m).toBeCloseTo(FREE_LAYOUT.start.x_m, 6);
    expect(race.you.state.robot.y_m).toBeCloseTo(FREE_LAYOUT.start.y_m, 6);
  });
});
