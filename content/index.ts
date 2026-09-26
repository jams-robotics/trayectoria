import type { RobotSpec } from '@trayectoria/robot-spec';
import type { Exercise } from '@trayectoria/sim-core';

import { robotCalcs as m00t01RobotCalcs } from './es/ruta-1/m00-t01/alrobot';
import { exercises as m00t01Exercises } from './es/ruta-1/m00-t01/ejercicios';
import { robotCalcs as m00t02RobotCalcs } from './es/ruta-1/m00-t02/alrobot';
import { exercises as m00t02Exercises } from './es/ruta-1/m00-t02/ejercicios';
import { exercises as m00t03Exercises } from './es/ruta-1/m00-t03/ejercicios';
import { robotCalcs as m01t01RobotCalcs } from './es/ruta-1/m01-t01/alrobot';
import { exercises as m01t01Exercises } from './es/ruta-1/m01-t01/ejercicios';
import { robotCalcs as m01t02RobotCalcs } from './es/ruta-1/m01-t02/alrobot';
import { exercises as m01t02Exercises } from './es/ruta-1/m01-t02/ejercicios';
import { robotCalcs as m01t03RobotCalcs } from './es/ruta-1/m01-t03/alrobot';
import { exercises as m01t03Exercises } from './es/ruta-1/m01-t03/ejercicios';
import { robotCalcs as m01t04RobotCalcs } from './es/ruta-1/m01-t04/alrobot';
import { exercises as m01t04Exercises } from './es/ruta-1/m01-t04/ejercicios';
import { robotCalcs as m02t01RobotCalcs } from './es/ruta-1/m02-t01/alrobot';
import { exercises as m02t01Exercises } from './es/ruta-1/m02-t01/ejercicios';
import { robotCalcs as m02t02RobotCalcs } from './es/ruta-1/m02-t02/alrobot';
import { exercises as m02t02Exercises } from './es/ruta-1/m02-t02/ejercicios';
import { robotCalcs as m02t03RobotCalcs } from './es/ruta-1/m02-t03/alrobot';
import { exercises as m02t03Exercises } from './es/ruta-1/m02-t03/ejercicios';
import { robotCalcs as m03t01RobotCalcs } from './es/ruta-1/m03-t01/alrobot';
import { exercises as m03t01Exercises } from './es/ruta-1/m03-t01/ejercicios';
import { robotCalcs as m03t02RobotCalcs } from './es/ruta-1/m03-t02/alrobot';
import { exercises as m03t02Exercises } from './es/ruta-1/m03-t02/ejercicios';
import { robotCalcs as m04t01RobotCalcs } from './es/ruta-1/m04-t01/alrobot';
import { exercises as m04t01Exercises } from './es/ruta-1/m04-t01/ejercicios';
import { robotCalcs as m04t02RobotCalcs } from './es/ruta-1/m04-t02/alrobot';
import { exercises as m04t02Exercises } from './es/ruta-1/m04-t02/ejercicios';
import { robotCalcs as m04t03RobotCalcs } from './es/ruta-1/m04-t03/alrobot';
import { exercises as m04t03Exercises } from './es/ruta-1/m04-t03/ejercicios';
import { robotCalcs as m04t04RobotCalcs } from './es/ruta-1/m04-t04/alrobot';
import { exercises as m04t04Exercises } from './es/ruta-1/m04-t04/ejercicios';
import { robotCalcs as m04t05RobotCalcs } from './es/ruta-1/m04-t05/alrobot';
import { exercises as m04t05Exercises } from './es/ruta-1/m04-t05/ejercicios';
import { robotCalcs as m05t01RobotCalcs } from './es/ruta-1/m05-t01/alrobot';
import { exercises as m05t01Exercises } from './es/ruta-1/m05-t01/ejercicios';
import { robotCalcs as m05t03RobotCalcs } from './es/ruta-1/m05-t03/alrobot';
import { exercises as m05t03Exercises } from './es/ruta-1/m05-t03/ejercicios';
import { robotCalcs as m05t02RobotCalcs } from './es/ruta-1/m05-t02/alrobot';
import { exercises as m05t02Exercises } from './es/ruta-1/m05-t02/ejercicios';
import { robotCalcs as m05t04RobotCalcs } from './es/ruta-1/m05-t04/alrobot';
import { exercises as m05t04Exercises } from './es/ruta-1/m05-t04/ejercicios';
import { robotCalcs as m05t05RobotCalcs } from './es/ruta-1/m05-t05/alrobot';
import { exercises as m05t05Exercises } from './es/ruta-1/m05-t05/ejercicios';
import { robotCalcs as m06t01RobotCalcs } from './es/ruta-1/m06-t01/alrobot';
import { exercises as m06t01Exercises } from './es/ruta-1/m06-t01/ejercicios';
import { robotCalcs as m06t03RobotCalcs } from './es/ruta-1/m06-t03/alrobot';
import { exercises as m06t03Exercises } from './es/ruta-1/m06-t03/ejercicios';
import { robotCalcs as m06t04RobotCalcs } from './es/ruta-1/m06-t04/alrobot';
import { exercises as m06t04Exercises } from './es/ruta-1/m06-t04/ejercicios';
import { robotCalcs as m06t02RobotCalcs } from './es/ruta-1/m06-t02/alrobot';
import { exercises as m06t02Exercises } from './es/ruta-1/m06-t02/ejercicios';
import { robotCalcs as m06t05RobotCalcs } from './es/ruta-1/m06-t05/alrobot';
import { exercises as m06t05Exercises } from './es/ruta-1/m06-t05/ejercicios';

/**
 * A topic exercise with its value type erased, so exercises of different topics share one map.
 *
 * `statement` is declared as a method: its parameter is then checked bivariantly, which lets any
 * `Exercise<V>` from `defineExercise` enter the map, and the entry still reads as an
 * `Exercise<unknown>` for whoever renders it.
 */
export interface TopicExercise extends Omit<Exercise<unknown>, 'statement'> {
  statement(values: unknown): string;
}

/** Registry key of an exercise: `<topicId>/<exerciseId>`, e.g. `ruta-1/m00-t01/e1`. */
export function exerciseKey(topicId: string, exerciseId: string): string {
  return `${topicId}/${exerciseId}`;
}

/**
 * Gathers the exercises that each topic exports from its `ejercicios.ts` into one map keyed by
 * `exerciseKey`. Two exercises with the same key are a content error, not an overwrite.
 */
export function registerTopics(
  topics: Readonly<Record<string, readonly TopicExercise[]>>,
): ReadonlyMap<string, TopicExercise> {
  return registerById(topics, exerciseKey, 'registerTopics: duplicate exercise key');
}

/** The formula of an «Al robot» calc: the symbolic form and the same one with the numbers in. */
export interface RobotCalcFormula {
  readonly latex: string;
  readonly substituted: string;
}

/**
 * One «Al robot» calc of a topic `alrobot.ts` (#243, decision 3): it turns the learner's robot
 * into the formula that `RobotFormula` renders. It is a function, so the island resolves it by
 * key instead of receiving it as a prop.
 */
export interface RobotCalc {
  readonly id: string;
  compute(robot: RobotSpec): RobotCalcFormula;
}

/** Registry key of a robot calc: `<topicId>/<calcId>`, e.g. `ruta-1/m00-t01/omega-rueda`. */
export function robotCalcKey(topicId: string, calcId: string): string {
  return `${topicId}/${calcId}`;
}

/**
 * Gathers the calcs that each topic exports from its `alrobot.ts` into one map keyed by
 * `robotCalcKey`, like `registerTopics` does with the exercises.
 */
export function registerRobotCalcs(
  topics: Readonly<Record<string, readonly RobotCalc[]>>,
): ReadonlyMap<string, RobotCalc> {
  return registerById(topics, robotCalcKey, 'registerRobotCalcs: duplicate robot calc key');
}

/** Files each item under `key(topicId, item.id)`; a repeated key throws `duplicate "<key>"`. */
function registerById<T extends { readonly id: string }>(
  topics: Readonly<Record<string, readonly T[]>>,
  key: (topicId: string, id: string) => string,
  duplicate: string,
): ReadonlyMap<string, T> {
  const registry = new Map<string, T>();
  for (const [topicId, items] of Object.entries(topics)) {
    for (const item of items) {
      const itemKey = key(topicId, item.id);
      if (registry.has(itemKey)) throw new Error(`${duplicate} "${itemKey}"`);
      registry.set(itemKey, item);
    }
  }
  return registry;
}

/**
 * Every topic exercise, keyed `<topicId>/<exerciseId>`. Each topic adds one entry here with the
 * exercises of its `content/es/<ruta>/<mNN-tNN>/ejercicios.ts`.
 */
export const EXERCISES: ReadonlyMap<string, TopicExercise> = registerTopics({
  'ruta-1/m00-t01': m00t01Exercises,
  'ruta-1/m00-t02': m00t02Exercises,
  'ruta-1/m00-t03': m00t03Exercises,
  'ruta-1/m01-t01': m01t01Exercises,
  'ruta-1/m01-t02': m01t02Exercises,
  'ruta-1/m01-t03': m01t03Exercises,
  'ruta-1/m01-t04': m01t04Exercises,
  'ruta-1/m02-t01': m02t01Exercises,
  'ruta-1/m02-t02': m02t02Exercises,
  'ruta-1/m02-t03': m02t03Exercises,
  'ruta-1/m03-t01': m03t01Exercises,
  'ruta-1/m03-t02': m03t02Exercises,
  'ruta-1/m04-t01': m04t01Exercises,
  'ruta-1/m04-t02': m04t02Exercises,
  'ruta-1/m04-t03': m04t03Exercises,
  'ruta-1/m04-t04': m04t04Exercises,
  'ruta-1/m04-t05': m04t05Exercises,
  'ruta-1/m05-t01': m05t01Exercises,
  'ruta-1/m05-t03': m05t03Exercises,
  'ruta-1/m05-t02': m05t02Exercises,
  'ruta-1/m05-t04': m05t04Exercises,
  'ruta-1/m05-t05': m05t05Exercises,
  'ruta-1/m06-t01': m06t01Exercises,
  'ruta-1/m06-t03': m06t03Exercises,
  'ruta-1/m06-t04': m06t04Exercises,
  'ruta-1/m06-t02': m06t02Exercises,
  'ruta-1/m06-t05': m06t05Exercises,
});

/**
 * Every «Al robot» calc, keyed `<topicId>/<calcId>`. Each topic adds one entry here with the
 * calcs of its `content/es/<ruta>/<mNN-tNN>/alrobot.ts`.
 */
export const ROBOT_CALCS: ReadonlyMap<string, RobotCalc> = registerRobotCalcs({
  'ruta-1/m00-t01': m00t01RobotCalcs,
  'ruta-1/m00-t02': m00t02RobotCalcs,
  'ruta-1/m01-t01': m01t01RobotCalcs,
  'ruta-1/m01-t02': m01t02RobotCalcs,
  'ruta-1/m01-t03': m01t03RobotCalcs,
  'ruta-1/m01-t04': m01t04RobotCalcs,
  'ruta-1/m02-t01': m02t01RobotCalcs,
  'ruta-1/m02-t02': m02t02RobotCalcs,
  'ruta-1/m02-t03': m02t03RobotCalcs,
  'ruta-1/m03-t01': m03t01RobotCalcs,
  'ruta-1/m03-t02': m03t02RobotCalcs,
  'ruta-1/m04-t01': m04t01RobotCalcs,
  'ruta-1/m04-t02': m04t02RobotCalcs,
  'ruta-1/m04-t03': m04t03RobotCalcs,
  'ruta-1/m04-t04': m04t04RobotCalcs,
  'ruta-1/m04-t05': m04t05RobotCalcs,
  'ruta-1/m05-t01': m05t01RobotCalcs,
  'ruta-1/m05-t03': m05t03RobotCalcs,
  'ruta-1/m05-t02': m05t02RobotCalcs,
  'ruta-1/m05-t04': m05t04RobotCalcs,
  'ruta-1/m05-t05': m05t05RobotCalcs,
  'ruta-1/m06-t01': m06t01RobotCalcs,
  'ruta-1/m06-t03': m06t03RobotCalcs,
  'ruta-1/m06-t04': m06t04RobotCalcs,
  'ruta-1/m06-t02': m06t02RobotCalcs,
  'ruta-1/m06-t05': m06t05RobotCalcs,
});
