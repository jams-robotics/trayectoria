import { describe, expect, test } from 'vitest';
import { REFERENCE_PID_PARAMS, pointAt, segmentLength_m } from '@trayectoria/sim-core';
import { parseRobotSpec, referenceMobile } from '@trayectoria/robot-spec';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { CONTROLLERS } from '../lineFollower/controllers';
import type { ControllerId, ControllerParams } from '../lineFollower/controllers';
import { ARENA_TRACKS, circuit } from './arenaTracks';
import { CHALLENGES, challengeOf } from './challenges';
import type { ChallengeId } from './challenges';
import { createRace } from './race';

function referenceSpec(): RobotSpec {
  const result = parseRobotSpec(referenceMobile);
  if (!result.ok) throw new Error('reference robot does not parse');
  return result.value;
}

/** Runs a challenge for `seconds` with the given controller and gains; true once it passes. */
function attempt(
  id: ChallengeId,
  controller: ControllerId,
  params: ControllerParams,
  seconds: number,
): boolean {
  const challenge = challengeOf(id);
  const race = createRace({
    spec: referenceSpec(),
    track: ARENA_TRACKS[challenge.track],
    controller,
    params: { ...CONTROLLERS[controller].defaults, ...params },
    ghost: challenge.ghost,
    seed: 7,
  });
  for (let t_s = 0; t_s < seconds; t_s += 0.05) {
    race.advance(0.05);
    if (challenge.passed({ controller, you: race.you, ghost: race.ghost })) return true;
  }
  return false;
}

describe('arena circuit', () => {
  test('every segment starts where the previous one ends, and it closes', () => {
    let s_m = 0;
    for (const segment of circuit.segments) {
      const start = pointAt(circuit, s_m + 1e-9);
      s_m += segmentLength_m(segment);
      const from = segment.type === 'line' ? segment.from : start;
      expect(start[0]).toBeCloseTo(from[0], 6);
      expect(start[1]).toBeCloseTo(from[1], 6);
    }
    const end = pointAt(circuit, s_m);
    expect(end[0]).toBeCloseTo(0, 6);
    expect(end[1]).toBeCloseTo(0, 6);
  });
});

describe('arena challenges have a solution and are not free', () => {
  test.each<[ChallengeId, ControllerId, ControllerParams, number]>([
    ['firstLap', 'pid', {}, 12],
    ['onoffOval', 'onoff', {}, 30],
    ['tightP', 'p', {}, 15],
    ['cleanS', 'pid', {}, 40],
    ['beatGhost', 'pid', { omegaBase_radps: 14 }, 20],
    ['ovalSprint', 'pid', { omegaBase_radps: 18 }, 15],
    ['cleanCircuit', 'pid', { omegaBase_radps: 18 }, 40],
  ])(
    '%s passes with %s %o',
    (id, controller, params, seconds) => {
      expect(attempt(id, controller, params, seconds)).toBe(true);
    },
    30_000,
  );

  test.each<[ChallengeId, ControllerId, ControllerParams, number]>([
    ['cleanS', 'onoff', {}, 40],
    ['beatGhost', 'pid', {}, 25],
    ['ovalSprint', 'pid', { ...REFERENCE_PID_PARAMS }, 15],
    ['cleanCircuit', 'pid', { omegaBase_radps: 14 }, 50],
    ['firstLap', 'manual', {}, 12],
  ])(
    '%s does not pass with %s %o',
    (id, controller, params, seconds) => {
      expect(attempt(id, controller, params, seconds)).toBe(false);
    },
    30_000,
  );

  test('ids are unique', () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
  });
});
