import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';

import { ExerciseWidget } from './ExerciseWidget';
import { trackTimeExercise } from './demo';

// Seed 2: the answer is 7.608258 / 0.392499 s, as in ExerciseWidget.test.tsx.
const ANSWER_S = 7.608258 / 0.392499;

async function answer(value: number): Promise<void> {
  const field = screen.getByRole('textbox', { name: /respuesta/i });
  await userEvent.clear(field);
  await userEvent.type(field, String(value));
  await userEvent.click(screen.getByRole('button', { name: 'Comprobar' }));
}

describe('ExerciseWidget feedback (v1.5)', () => {
  test('generic hint first, a calculated one second, the solution third', async () => {
    render(<ExerciseWidget exercise={trackTimeExercise} topicId="t" seed={2} />);
    await answer(ANSWER_S * 60);
    expect(screen.getByTestId('exercise-hint')).toHaveTextContent('Revisa el cálculo y las unidades.');
    expect(screen.queryByTestId('exercise-solution')).toBeNull();
    await answer(ANSWER_S * 60);
    expect(screen.getByTestId('exercise-hint')).toHaveTextContent('60 veces mayor');
    await answer(-ANSWER_S);
    expect(screen.getByTestId('exercise-hint')).toHaveTextContent('signo contrario');
    expect(screen.getByTestId('exercise-solution')).toHaveTextContent(/Solución: 19\.4 s/);
  });
});
