import type * as Content from '@trayectoria/content';
import { componentsExercise, trackTimeExercise } from '@trayectoria/widgets/ExerciseWidget';
import { describe, expect, it, vi } from 'vitest';

import { exerciseKeys, findExercise } from './exercises';

// El mapa real de `@trayectoria/content` está vacío hasta T-0.1: se sustituye por uno construido
// con el `registerTopics` real y un tema de prueba, fuera de `content/es/`.
vi.mock('@trayectoria/content', async (importOriginal) => {
  const actual = await importOriginal<typeof Content>();
  const { componentsExercise: fixture } = await import('@trayectoria/widgets/ExerciseWidget');
  return { ...actual, EXERCISES: actual.registerTopics({ 'ruta-9/m99-t99': [fixture] }) };
});

describe('exercises registry', () => {
  it('keeps the demo exercise under demo/track-time', () => {
    expect(findExercise('demo/track-time')).toBe(trackTimeExercise);
  });

  it('resolves a topic exercise by its <topicId>/<exerciseId> key', () => {
    expect(findExercise('ruta-9/m99-t99/e1')).toBe(componentsExercise);
  });

  it('lists the demo key and every content key', () => {
    expect(exerciseKeys()).toEqual(['demo/track-time', 'ruta-9/m99-t99/e1']);
  });

  it('returns undefined for an unknown key', () => {
    expect(findExercise('ruta-9/m99-t99/e2')).toBeUndefined();
  });
});
