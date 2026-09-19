import type { JSX } from 'react';
import { ExerciseWidget } from '@trayectoria/widgets';

import { findExercise } from '../../lib/exercises';

/**
 * Isla de cliente que monta un `ExerciseWidget` a partir de la clave del ejercicio, no del
 * objeto `Exercise` (#97, hallazgo alta de auditoría del PR #119): Astro serializa a JSON las
 * props de una isla `client:visible`, y las funciones `generate`/`check` de `Exercise` no
 * sobreviven esa serialización. `Verifica.astro` ya valida la clave contra el registro en tiempo
 * de build, así que aquí solo se resuelve de nuevo (el registro es el mismo módulo).
 */
export interface VerificaExerciseProps {
  readonly exerciseKey: string;
  readonly topicId: string;
  readonly index: number;
  readonly required: boolean;
}

export function VerificaExercise({
  exerciseKey,
  topicId,
  index,
  required,
}: VerificaExerciseProps): JSX.Element {
  const exercise = findExercise(exerciseKey);
  if (exercise === undefined) {
    // `Verifica.astro` ya falló el build si la clave no existe; esto solo cierra el tipo.
    throw new Error(`unknown exercise key "${exerciseKey}" (components/tema/VerificaExercise)`);
  }
  return (
    <ExerciseWidget exercise={exercise} topicId={topicId} index={index} required={required} />
  );
}
