import { useMemo } from 'react';
import type { JSX } from 'react';
import { progressAdapterFor } from '@trayectoria/progress';
import { ExerciseWidget, ProgressAdapterProvider } from '@trayectoria/widgets/ExerciseWidget';

import { findExercise } from '../../lib/exercises';

/**
 * Isla de cliente que monta un `ExerciseWidget` a partir de la clave del ejercicio, no del
 * objeto `Exercise` (#97, hallazgo alta de auditoría del PR #119): Astro serializa a JSON las
 * props de una isla `client:visible`, y las funciones `generate`/`check` de `Exercise` no
 * sobreviven esa serialización. `Verifica.astro` ya valida la clave contra el registro en tiempo
 * de build, así que aquí solo se resuelve de nuevo (el registro es el mismo módulo).
 *
 * Además inyecta el adaptador real de `@trayectoria/progress` (#120, decisión 1): solo
 * `apps/web` puede importar a la vez `widgets` y `progress`. El adaptador necesita los
 * obligatorios **completos** del tema, no solo si este ejercicio lo es, porque la regla de
 * completado compara ese conjunto entero con los ejercicios acertados.
 */
export interface VerificaExerciseProps {
  readonly exerciseKey: string;
  readonly topicId: string;
  readonly index: number;
  readonly required: boolean;
  /** Ids de los ejercicios obligatorios del tema, completos (#120, decisión 1). */
  readonly requiredExerciseIds: readonly string[];
}

export function VerificaExercise({
  exerciseKey,
  topicId,
  index,
  required,
  requiredExerciseIds,
}: VerificaExerciseProps): JSX.Element {
  const exercise = findExercise(exerciseKey);
  const ids = requiredExerciseIds.join(',');
  const adapter = useMemo(() => progressAdapterFor(ids === '' ? [] : ids.split(',')), [ids]);
  if (exercise === undefined) {
    // `Verifica.astro` ya falló el build si la clave no existe; esto solo cierra el tipo.
    throw new Error(`unknown exercise key "${exerciseKey}" (components/tema/VerificaExercise)`);
  }
  return (
    <ProgressAdapterProvider adapter={adapter}>
      <ExerciseWidget exercise={exercise} topicId={topicId} index={index} required={required} />
    </ProgressAdapterProvider>
  );
}
