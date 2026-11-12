import { defineChoiceExercise } from '@trayectoria/sim-core';

// Multiple-choice exercises of v1.5 (docs/CONTENT-STANDARDS.md §2.6): one conceptual or prediction
// question per topic, about what its widget shows. They live apart from each topic's
// `ejercicios.ts` because those files hold numeric exercises that their tests grade with one
// relative tolerance. `content/index.ts` registers them under the topic's id.
//
// Texts in content.json: the statement is `content.<topic>.<id>`, the options are
// `content.<topic>.labels.<id>.<n>` and the explanation is `content.<topic>.<id>0`.

type ChoiceExercise = ReturnType<typeof defineChoiceExercise>;

function choice(topicId: string, id: string, options: number, correct: number): ChoiceExercise {
  const base = `content.${topicId}`;
  return defineChoiceExercise({
    id,
    statement: `${base}.${id}`,
    options: Array.from({ length: options }, (_, n) => `${base}.labels.${id}.${n}`),
    correct,
    explanation: `${base}.${id}0`,
  });
}

export const choiceExercises: Readonly<Record<string, readonly ChoiceExercise[]>> = {
  'ruta-1/m00-t01': [choice('ruta-1/m00-t01', 'e5', 3, 0)],
  'ruta-1/m00-t02': [choice('ruta-1/m00-t02', 'e5', 3, 1)],
  'ruta-1/m00-t03': [choice('ruta-1/m00-t03', 'e5', 3, 1)],
  'ruta-1/m01-t01': [choice('ruta-1/m01-t01', 'e5', 3, 0)],
  'ruta-1/m01-t02': [choice('ruta-1/m01-t02', 'e5', 3, 1)],
  'ruta-1/m01-t03': [choice('ruta-1/m01-t03', 'e5', 3, 2)],
  'ruta-1/m01-t04': [choice('ruta-1/m01-t04', 'e5', 3, 0)],
  'ruta-1/m02-t01': [choice('ruta-1/m02-t01', 'e5', 3, 1)],
  'ruta-1/m02-t02': [choice('ruta-1/m02-t02', 'e5', 3, 2)],
  'ruta-1/m02-t03': [choice('ruta-1/m02-t03', 'e5', 3, 1)],
  'ruta-1/m02-t04': [choice('ruta-1/m02-t04', 'e5', 3, 0)],
  'ruta-1/m03-t01': [choice('ruta-1/m03-t01', 'e5', 3, 2)],
  'ruta-1/m03-t02': [choice('ruta-1/m03-t02', 'e5', 3, 1)],
  'ruta-1/m03-t03': [choice('ruta-1/m03-t03', 'e5', 3, 1)],
  'ruta-2/m00-t01': [choice('ruta-2/m00-t01', 'e5', 3, 1)],
  'ruta-2/m00-t02': [choice('ruta-2/m00-t02', 'e5', 3, 1)],
  'ruta-2/m01-t01': [choice('ruta-2/m01-t01', 'e5', 3, 0)],
  'ruta-2/m01-t02': [choice('ruta-2/m01-t02', 'e5', 3, 1)],
  'ruta-2/m01-t03': [choice('ruta-2/m01-t03', 'e5', 3, 2)],
  'ruta-2/m01-t04': [choice('ruta-2/m01-t04', 'e4', 3, 1)],
  'ruta-2/m02-t01': [choice('ruta-2/m02-t01', 'e5', 3, 0)],
  'ruta-2/m02-t02': [choice('ruta-2/m02-t02', 'e4', 3, 1)],
  'ruta-2/m02-t03': [choice('ruta-2/m02-t03', 'e5', 3, 1)],
  'ruta-2/m02-t04': [choice('ruta-2/m02-t04', 'e5', 3, 0)],
  'ruta-2/m02-t05': [choice('ruta-2/m02-t05', 'e4', 3, 1)],
};
