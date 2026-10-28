import { describe, expect, test } from 'vitest';
import { parseRobotSpec, referenceMobile } from '@trayectoria/robot-spec';

import { ARENA_TRACKS } from './arenaTracks';
import { createDuoRace, DUO_LAPS } from './duoRace';
import type { DuoWorld } from './duoRace';
import { FREE_LAYOUT, ROBOT_RADIUS_M } from './freeArena';

function raceOn(world: DuoWorld) {
  const result = parseRobotSpec(referenceMobile);
  if (!result.ok) throw new Error('reference robot does not parse');
  return createDuoRace(result.value, world);
}

function run(race: ReturnType<typeof raceOn>, seconds: number): void {
  for (let i = 0; i < seconds * 10; i += 1) race.advance(0.1);
}

const STOP = { omegaL_radps: 0, omegaR_radps: 0 };
const GO = { omegaL_radps: 10, omegaR_radps: 10 };

describe('createDuoRace', () => {
  test('stays at the start, side by side and not overlapping, until someone moves', () => {
    const race = raceOn({ layout: FREE_LAYOUT });
    run(race, 1);
    const [a, b] = [race.you.state.robot, race.ghost.state.robot];
    expect(Math.hypot(a.x_m - b.x_m, a.y_m - b.y_m)).toBeGreaterThanOrEqual(2 * ROBOT_RADIUS_M);
    expect(race.duo).toMatchObject({ kind: 'stars', scores: [0, 0], time_s: 0, done: false });
  });

  test('the robots never go through each other when one drives into the other', () => {
    const race = raceOn({ layout: FREE_LAYOUT });
    race.setCommand(GO);
    race.setCommand2({ omegaL_radps: 10, omegaR_radps: 6 });
    for (let i = 0; i < 80; i += 1) {
      race.advance(0.1);
      const [a, b] = [race.you.state.robot, race.ghost.state.robot];
      expect(Math.hypot(a.x_m - b.x_m, a.y_m - b.y_m)).toBeGreaterThanOrEqual(
        2 * ROBOT_RADIUS_M - 1e-9,
      );
    }
  });

  test('a star goes to the first player that reaches it and disappears for the other', () => {
    const race = raceOn({ layout: FREE_LAYOUT });
    race.setCommand(GO);
    race.setCommand2(STOP);
    run(race, 12);
    expect(race.duo.scores[0]).toBeGreaterThan(0);
    expect(race.duo.scores[1]).toBe(0);
    expect(race.taken.filter(Boolean)).toHaveLength(race.duo.scores[0]);
  });

  test('on a track it counts laps for each player and nobody derails', () => {
    const race = raceOn({ track: ARENA_TRACKS.oval });
    race.setCommand(GO);
    race.setCommand2(STOP);
    run(race, 5);
    expect(race.you.derailed).toBe(false);
    expect(race.duo).toMatchObject({ kind: 'laps', goal: DUO_LAPS, scores: [0, 0], done: false });
    expect(race.duo.time_s).toBeGreaterThan(0);
  });

  test('ends when the last star is taken and the one who took it wins', () => {
    const { start } = FREE_LAYOUT;
    const goals = [{ x_m: start.x_m + 0.5, y_m: start.y_m + 0.1 }];
    const race = raceOn({ layout: { ...FREE_LAYOUT, cones: [], goals } });
    race.setCommand(GO);
    race.setCommand2(STOP);
    run(race, 6);
    expect(race.duo).toMatchObject({ scores: [1, 0], done: true, winner: 1 });
    const time_s = race.duo.time_s;
    run(race, 2);
    expect(race.duo.time_s).toBe(time_s);
  });
});
