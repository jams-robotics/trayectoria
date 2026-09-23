import { EXERCISES as TOPIC_EXERCISES } from '@trayectoria/content';
import type { TopicExercise } from '@trayectoria/content';
import { trackTimeExercise } from '@trayectoria/widgets/ExerciseWidget';

/**
 * Registro clave → `Exercise` que resuelve `VerificaExercise` en el cliente (#97, hallazgo alta
 * de auditoría del PR #119). `Verifica.astro` monta la isla con solo la clave (serializable);
 * el objeto `Exercise` completo, con sus funciones `generate`/`check`, no sobrevive la
 * serialización JSON que Astro hace de las props de una isla `client:visible`.
 *
 * Se construye con el mapa de `@trayectoria/content` (claves `<topicId>/<exerciseId>`, p. ej.
 * `ruta-1/m00-t01/e1`, F6-00) y conserva el escalar de demostración de `ExerciseWidget/demo.ts`
 * bajo `demo/track-time` (#97, decisión 4).
 *
 * `apps/web` no puede importar `@trayectoria/sim-core` (docs/ARCHITECTURE.md §2), así que el
 * tipo del ejercicio se toma de `@trayectoria/content`.
 */
const EXERCISES = new Map<string, TopicExercise>([
  ['demo/track-time', trackTimeExercise],
  ...TOPIC_EXERCISES,
]);

/** Claves válidas del registro, para el error de build de `Verifica.astro`. */
export function exerciseKeys(): readonly string[] {
  return [...EXERCISES.keys()];
}

/** Resuelve una clave a su `Exercise`, o `undefined` si no está en el registro. */
export function findExercise(key: string): TopicExercise | undefined {
  return EXERCISES.get(key);
}
