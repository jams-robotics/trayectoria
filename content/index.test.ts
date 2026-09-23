import { createRng, defineExercise } from '@trayectoria/sim-core';
import { describe, expect, it } from 'vitest';

import {
  EXERCISES,
  ROBOT_CALCS,
  exerciseKey,
  registerRobotCalcs,
  registerTopics,
  robotCalcKey,
} from './index';
import type { RobotCalc } from './index';

/** Shape of every registry key: `<topicId>/<exerciseId>`, e.g. `ruta-1/m00-t01/e1`. */
const KEY_SHAPE = /^ruta-\d+\/m\d{2}-t\d{2}\/e\d+$/;

/** Shape of every robot calc key: `<topicId>/<calcId>`, e.g. `ruta-1/m00-t01/omega-rueda`. */
const CALC_KEY_SHAPE = /^ruta-\d+\/m\d{2}-t\d{2}\/[a-z0-9-]+$/;

interface Wheel {
  readonly radius_m: number;
}

// A test `ejercicios.ts`, kept out of `content/es/` so no real topic depends on it.
const fixtureExercises = [
  defineExercise<Wheel>({
    id: 'e1',
    generate: (rng) => {
      const radius_m = 0.015 + rng.next() * 0.035;
      return { values: { radius_m }, answer: 2 * radius_m, unit: 'm' };
    },
    statement: () => 'fixture.e1',
    tolerance: { type: 'relative', value: 0.02 },
  }),
  defineExercise<Wheel>({
    id: 'e2',
    generate: (rng) => {
      const radius_m = 0.015 + rng.next() * 0.035;
      return { values: { radius_m }, answer: 2 * Math.PI * radius_m, unit: 'm' };
    },
    statement: () => 'fixture.e2',
    tolerance: { type: 'relative', value: 0.02 },
  }),
];

describe('EXERCISES', () => {
  it('only holds keys shaped <topicId>/<exerciseId>', () => {
    for (const key of EXERCISES.keys()) expect(key).toMatch(KEY_SHAPE);
  });

  it('files each exercise under its own id', () => {
    for (const [key, exercise] of EXERCISES) expect(key.endsWith(`/${exercise.id}`)).toBe(true);
  });
});

describe('exerciseKey', () => {
  it('joins the topic id and the exercise id', () => {
    expect(exerciseKey('ruta-1/m00-t01', 'e1')).toBe('ruta-1/m00-t01/e1');
  });
});

describe('registerTopics', () => {
  it('registers a topic ejercicios.ts and resolves each exercise by its key', () => {
    const registry = registerTopics({ 'ruta-9/m99-t99': fixtureExercises });

    expect([...registry.keys()]).toEqual(['ruta-9/m99-t99/e1', 'ruta-9/m99-t99/e2']);
    for (const key of registry.keys()) expect(key).toMatch(KEY_SHAPE);
    const e2 = registry.get('ruta-9/m99-t99/e2');
    expect(e2).toBe(fixtureExercises[1]);
    expect(e2?.generate(createRng(1)).unit).toBe('m');
  });

  it('returns undefined for a key no topic declares', () => {
    const registry = registerTopics({ 'ruta-9/m99-t99': fixtureExercises });

    expect(registry.get('ruta-9/m99-t99/e3')).toBeUndefined();
  });

  it('rejects two exercises with the same key', () => {
    const [e1] = fixtureExercises;

    expect(() => registerTopics({ 'ruta-9/m99-t99': [e1!, e1!] })).toThrow(
      'duplicate exercise key "ruta-9/m99-t99/e1"',
    );
  });
});

// A test `alrobot.ts`, kept out of `content/es/` like the exercises above. `content` imports
// `robot-spec` for its types only, so the golden values of a calc run with the reference robot
// in `apps/web` (`src/lib/robotCalcs.test.ts`).
const fixtureCalcs: readonly RobotCalc[] = [
  {
    id: 'omega-motor',
    compute: (robot) => ({
      latex: String.raw`\omega_{\text{motor}} = n \cdot 2\pi / 60`,
      substituted: String(robot.mobile?.maxMotorSpeed_rpm),
    }),
  },
  {
    id: 'omega-rueda',
    compute: (robot) => ({
      latex: String.raw`\omega_{\text{rueda}} = \omega_{\text{motor}} / i`,
      substituted: String(robot.mobile?.gearRatio),
    }),
  },
];

describe('ROBOT_CALCS', () => {
  it('only holds keys shaped <topicId>/<calcId>', () => {
    for (const key of ROBOT_CALCS.keys()) expect(key).toMatch(CALC_KEY_SHAPE);
  });

  it('files each calc under its own id', () => {
    for (const [key, calc] of ROBOT_CALCS) expect(key.endsWith(`/${calc.id}`)).toBe(true);
  });
});

describe('robotCalcKey', () => {
  it('joins the topic id and the calc id', () => {
    expect(robotCalcKey('ruta-1/m00-t01', 'omega-rueda')).toBe('ruta-1/m00-t01/omega-rueda');
  });
});

describe('registerRobotCalcs', () => {
  it('registers a topic alrobot.ts and resolves each calc by its key', () => {
    const registry = registerRobotCalcs({ 'ruta-9/m99-t99': fixtureCalcs });

    expect([...registry.keys()]).toEqual([
      'ruta-9/m99-t99/omega-motor',
      'ruta-9/m99-t99/omega-rueda',
    ]);
    for (const key of registry.keys()) expect(key).toMatch(CALC_KEY_SHAPE);
    expect(registry.get('ruta-9/m99-t99/omega-rueda')).toBe(fixtureCalcs[1]);
  });

  it('returns undefined for a key no topic declares', () => {
    const registry = registerRobotCalcs({ 'ruta-9/m99-t99': fixtureCalcs });

    expect(registry.get('ruta-9/m99-t99/v-lineal')).toBeUndefined();
  });

  it('rejects two calcs with the same key', () => {
    const [calc] = fixtureCalcs;

    expect(() => registerRobotCalcs({ 'ruta-9/m99-t99': [calc!, calc!] })).toThrow(
      'duplicate robot calc key "ruta-9/m99-t99/omega-motor"',
    );
  });
});
