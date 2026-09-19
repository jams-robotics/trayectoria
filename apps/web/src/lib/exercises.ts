import { trackTimeExercise } from '@trayectoria/widgets';

/**
 * Registro clave → `Exercise` que resuelve `VerificaExercise` en el cliente (#97, hallazgo alta
 * de auditoría del PR #119). `Verifica.astro` monta la isla con solo la clave (serializable);
 * el objeto `Exercise` completo, con sus funciones `generate`/`check`, no sobrevive la
 * serialización JSON que Astro hace de las props de una isla `client:visible`.
 *
 * Mientras no haya `ejercicios.ts` por tema (llega con T-0.1), el único registrado es el escalar
 * de demostración de `ExerciseWidget/demo.ts` (#97, decisión 4).
 *
 * `apps/web` no puede importar `@trayectoria/sim-core` (docs/ARCHITECTURE.md §2), así que el
 * tipo del ejercicio se toma del widget, igual que el `Verifica.astro` original.
 */
type TopicExercise = typeof trackTimeExercise;

const EXERCISES = new Map<string, TopicExercise>([['demo/track-time', trackTimeExercise]]);

/** Claves válidas del registro, para el error de build de `Verifica.astro`. */
export function exerciseKeys(): readonly string[] {
  return [...EXERCISES.keys()];
}

/** Resuelve una clave a su `Exercise`, o `undefined` si no está en el registro. */
export function findExercise(key: string): TopicExercise | undefined {
  return EXERCISES.get(key);
}
