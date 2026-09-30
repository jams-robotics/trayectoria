import type { RobotSpec } from '@trayectoria/robot-spec';
import type { Exercise } from '@trayectoria/sim-core';

import { robotCalcs as ruta1M00T01RobotCalcs } from './es/ruta-1/m00-t01/alrobot';
import { exercises as ruta1M00T01Exercises } from './es/ruta-1/m00-t01/ejercicios';
import { robotCalcs as ruta1M00T02RobotCalcs } from './es/ruta-1/m00-t02/alrobot';
import { exercises as ruta1M00T02Exercises } from './es/ruta-1/m00-t02/ejercicios';
import { exercises as ruta1M00T03Exercises } from './es/ruta-1/m00-t03/ejercicios';
import { robotCalcs as ruta1M01T01RobotCalcs } from './es/ruta-1/m01-t01/alrobot';
import { exercises as ruta1M01T01Exercises } from './es/ruta-1/m01-t01/ejercicios';
import { robotCalcs as ruta1M01T02RobotCalcs } from './es/ruta-1/m01-t02/alrobot';
import { exercises as ruta1M01T02Exercises } from './es/ruta-1/m01-t02/ejercicios';
import { robotCalcs as ruta1M01T03RobotCalcs } from './es/ruta-1/m01-t03/alrobot';
import { exercises as ruta1M01T03Exercises } from './es/ruta-1/m01-t03/ejercicios';
import { robotCalcs as ruta1M01T04RobotCalcs } from './es/ruta-1/m01-t04/alrobot';
import { exercises as ruta1M01T04Exercises } from './es/ruta-1/m01-t04/ejercicios';
import { robotCalcs as ruta1M02T01RobotCalcs } from './es/ruta-1/m02-t01/alrobot';
import { exercises as ruta1M02T01Exercises } from './es/ruta-1/m02-t01/ejercicios';
import { robotCalcs as ruta1M02T02RobotCalcs } from './es/ruta-1/m02-t02/alrobot';
import { exercises as ruta1M02T02Exercises } from './es/ruta-1/m02-t02/ejercicios';
import { robotCalcs as ruta1M02T03RobotCalcs } from './es/ruta-1/m02-t03/alrobot';
import { exercises as ruta1M02T03Exercises } from './es/ruta-1/m02-t03/ejercicios';
import { robotCalcs as ruta1M02T04RobotCalcs } from './es/ruta-1/m02-t04/alrobot';
import { exercises as ruta1M02T04Exercises } from './es/ruta-1/m02-t04/ejercicios';
import { robotCalcs as ruta1M03T01RobotCalcs } from './es/ruta-1/m03-t01/alrobot';
import { exercises as ruta1M03T01Exercises } from './es/ruta-1/m03-t01/ejercicios';
import { robotCalcs as ruta1M03T02RobotCalcs } from './es/ruta-1/m03-t02/alrobot';
import { exercises as ruta1M03T02Exercises } from './es/ruta-1/m03-t02/ejercicios';
import { robotCalcs as ruta1M03T03RobotCalcs } from './es/ruta-1/m03-t03/alrobot';
import { exercises as ruta1M03T03Exercises } from './es/ruta-1/m03-t03/ejercicios';
import { robotCalcs as ruta2M00T01RobotCalcs } from './es/ruta-2/m00-t01/alrobot';
import { exercises as ruta2M00T01Exercises } from './es/ruta-2/m00-t01/ejercicios';
import { robotCalcs as ruta2M00T02RobotCalcs } from './es/ruta-2/m00-t02/alrobot';
import { exercises as ruta2M00T02Exercises } from './es/ruta-2/m00-t02/ejercicios';
import { robotCalcs as ruta2M01T01RobotCalcs } from './es/ruta-2/m01-t01/alrobot';
import { exercises as ruta2M01T01Exercises } from './es/ruta-2/m01-t01/ejercicios';
import { robotCalcs as ruta2M01T02RobotCalcs } from './es/ruta-2/m01-t02/alrobot';
import { exercises as ruta2M01T02Exercises } from './es/ruta-2/m01-t02/ejercicios';
import { robotCalcs as ruta2M01T03RobotCalcs } from './es/ruta-2/m01-t03/alrobot';
import { exercises as ruta2M01T03Exercises } from './es/ruta-2/m01-t03/ejercicios';
import { robotCalcs as ruta2M01T04RobotCalcs } from './es/ruta-2/m01-t04/alrobot';
import { exercises as ruta2M01T04Exercises } from './es/ruta-2/m01-t04/ejercicios';
import { robotCalcs as ruta2M02T01RobotCalcs } from './es/ruta-2/m02-t01/alrobot';
import { exercises as ruta2M02T01Exercises } from './es/ruta-2/m02-t01/ejercicios';
import { robotCalcs as ruta2M02T02RobotCalcs } from './es/ruta-2/m02-t02/alrobot';
import { exercises as ruta2M02T02Exercises } from './es/ruta-2/m02-t02/ejercicios';
import { robotCalcs as ruta2M02T03RobotCalcs } from './es/ruta-2/m02-t03/alrobot';
import { exercises as ruta2M02T03Exercises } from './es/ruta-2/m02-t03/ejercicios';
import { robotCalcs as ruta2M02T04RobotCalcs } from './es/ruta-2/m02-t04/alrobot';
import { exercises as ruta2M02T04Exercises } from './es/ruta-2/m02-t04/ejercicios';
import { robotCalcs as ruta2M02T05RobotCalcs } from './es/ruta-2/m02-t05/alrobot';
import { exercises as ruta2M02T05Exercises } from './es/ruta-2/m02-t05/ejercicios';
import { robotCalcs as caidaLibreRobotCalcs } from './es/reserva/caida-libre/alrobot';
import { exercises as caidaLibreExercises } from './es/reserva/caida-libre/ejercicios';
import { robotCalcs as tiroParabolicoRobotCalcs } from './es/reserva/tiro-parabolico/alrobot';
import { exercises as tiroParabolicoExercises } from './es/reserva/tiro-parabolico/ejercicios';

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
 * exercises of its `content/es/<ruta>/<mNN-tNN>/ejercicios.ts`, or `content/es/reserva/<slug>/` for
 * a topic in the reserve (docs/ARCHITECTURE.md §3.3).
 */
export const EXERCISES: ReadonlyMap<string, TopicExercise> = registerTopics({
  'ruta-1/m00-t01': ruta1M00T01Exercises,
  'ruta-1/m00-t02': ruta1M00T02Exercises,
  'ruta-1/m00-t03': ruta1M00T03Exercises,
  'ruta-1/m01-t01': ruta1M01T01Exercises,
  'ruta-1/m01-t02': ruta1M01T02Exercises,
  'ruta-1/m01-t03': ruta1M01T03Exercises,
  'ruta-1/m01-t04': ruta1M01T04Exercises,
  'ruta-1/m02-t01': ruta1M02T01Exercises,
  'ruta-1/m02-t02': ruta1M02T02Exercises,
  'ruta-1/m02-t03': ruta1M02T03Exercises,
  'ruta-1/m02-t04': ruta1M02T04Exercises,
  'ruta-1/m03-t01': ruta1M03T01Exercises,
  'ruta-1/m03-t02': ruta1M03T02Exercises,
  'ruta-1/m03-t03': ruta1M03T03Exercises,
  'ruta-2/m00-t01': ruta2M00T01Exercises,
  'ruta-2/m00-t02': ruta2M00T02Exercises,
  'ruta-2/m01-t01': ruta2M01T01Exercises,
  'ruta-2/m01-t02': ruta2M01T02Exercises,
  'ruta-2/m01-t03': ruta2M01T03Exercises,
  'ruta-2/m01-t04': ruta2M01T04Exercises,
  'ruta-2/m02-t01': ruta2M02T01Exercises,
  'ruta-2/m02-t02': ruta2M02T02Exercises,
  'ruta-2/m02-t03': ruta2M02T03Exercises,
  'ruta-2/m02-t04': ruta2M02T04Exercises,
  'ruta-2/m02-t05': ruta2M02T05Exercises,
  'reserva/caida-libre': caidaLibreExercises,
  'reserva/tiro-parabolico': tiroParabolicoExercises,
});

/**
 * Every «Al robot» calc, keyed `<topicId>/<calcId>`. Each topic adds one entry here with the
 * calcs of its `content/es/<ruta>/<mNN-tNN>/alrobot.ts`, or of the reserve, like `EXERCISES`.
 */
export const ROBOT_CALCS: ReadonlyMap<string, RobotCalc> = registerRobotCalcs({
  'ruta-1/m00-t01': ruta1M00T01RobotCalcs,
  'ruta-1/m00-t02': ruta1M00T02RobotCalcs,
  'ruta-1/m01-t01': ruta1M01T01RobotCalcs,
  'ruta-1/m01-t02': ruta1M01T02RobotCalcs,
  'ruta-1/m01-t03': ruta1M01T03RobotCalcs,
  'ruta-1/m01-t04': ruta1M01T04RobotCalcs,
  'ruta-1/m02-t01': ruta1M02T01RobotCalcs,
  'ruta-1/m02-t02': ruta1M02T02RobotCalcs,
  'ruta-1/m02-t03': ruta1M02T03RobotCalcs,
  'ruta-1/m02-t04': ruta1M02T04RobotCalcs,
  'ruta-1/m03-t01': ruta1M03T01RobotCalcs,
  'ruta-1/m03-t02': ruta1M03T02RobotCalcs,
  'ruta-1/m03-t03': ruta1M03T03RobotCalcs,
  'ruta-2/m00-t01': ruta2M00T01RobotCalcs,
  'ruta-2/m00-t02': ruta2M00T02RobotCalcs,
  'ruta-2/m01-t01': ruta2M01T01RobotCalcs,
  'ruta-2/m01-t02': ruta2M01T02RobotCalcs,
  'ruta-2/m01-t03': ruta2M01T03RobotCalcs,
  'ruta-2/m01-t04': ruta2M01T04RobotCalcs,
  'ruta-2/m02-t01': ruta2M02T01RobotCalcs,
  'ruta-2/m02-t02': ruta2M02T02RobotCalcs,
  'ruta-2/m02-t03': ruta2M02T03RobotCalcs,
  'ruta-2/m02-t04': ruta2M02T04RobotCalcs,
  'ruta-2/m02-t05': ruta2M02T05RobotCalcs,
  'reserva/caida-libre': caidaLibreRobotCalcs,
  'reserva/tiro-parabolico': tiroParabolicoRobotCalcs,
});
