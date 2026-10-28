import { describe, expect, test } from 'vitest';
import { parseRobotSpec, referenceMobile } from '@trayectoria/robot-spec';

import { CONTROLLERS } from '../lineFollower/controllers';
import { ARENA_TRACKS } from './arenaTracks';
import { DERAIL_AFTER_S, KICK_RAD, createRace } from './race';

function spec() {
  const result = parseRobotSpec(referenceMobile);
  if (!result.ok) throw new Error('reference robot does not parse');
  return result.value;
}

function race(ghost = false) {
  return createRace({
    spec: spec(),
    track: ARENA_TRACKS.oval,
    controller: 'pid',
    params: CONTROLLERS.pid.defaults,
    ghost,
    seed: 7,
  });
}

describe('createRace', () => {
  test('the result depends on the simulated time, not on how frames split it', () => {
    const coarse = race();
    const fine = race();
    for (let i = 0; i < 100; i += 1) coarse.advance(0.05);
    for (let i = 0; i < 500; i += 1) fine.advance(0.01);
    expect(fine.you.state.robot.x_m).toBeCloseTo(coarse.you.state.robot.x_m, 9);
    expect(fine.you.state.robot.t_s).toBeCloseTo(5, 6);
  });

  test('closes laps with their time (reference PID on the oval: 8.58 s, then 8.38 s)', () => {
    const run = race();
    for (let i = 0; i < 400; i += 1) run.advance(0.05);
    expect(run.you.laps_s[0]).toBeCloseTo(8.58, 1);
    expect(run.you.laps_s[1]).toBeCloseTo(8.38, 1);
  });

  test('the ghost runs the reference PID next to the learner', () => {
    const run = race(true);
    run.setParams({ ...CONTROLLERS.pid.defaults, omegaBase_radps: 14 });
    for (let i = 0; i < 200; i += 1) run.advance(0.05);
    expect(run.ghost).not.toBeNull();
    expect(run.you.state.distance_m).toBeGreaterThan(run.ghost?.state.distance_m ?? Infinity);
  });

  test('a kick turns the robot and the controller brings it back', () => {
    const run = race();
    for (let i = 0; i < 20; i += 1) run.advance(0.05);
    const before = run.you.state.robot.theta_rad;
    run.kick(KICK_RAD);
    expect(run.you.state.robot.theta_rad).toBeCloseTo(before + KICK_RAD, 9);
    for (let i = 0; i < 200; i += 1) run.advance(0.05);
    expect(run.you.derailed).toBe(false);
  });

  test('a robot that leaves the line for long enough derails and stops', () => {
    const run = race();
    run.setCommand({ omegaL_radps: 10, omegaR_radps: 4 });
    for (let i = 0; i < 200; i += 1) run.advance(0.05);
    expect(run.you.derailed).toBe(true);
    expect(run.you.lostFor_s).toBeGreaterThanOrEqual(DERAIL_AFTER_S);
    const x = run.you.state.robot.x_m;
    run.advance(0.05);
    expect(run.you.state.robot.x_m).toBe(x);
  });
});
