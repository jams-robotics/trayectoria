import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { defineChoiceExercise } from '@trayectoria/sim-core';

import { ExerciseWidget } from './ExerciseWidget';

// Keys that are not in the catalogue render as themselves, so the assertions read the keys.
const exercise = defineChoiceExercise({
  id: 'c1',
  statement: 'st',
  options: ['optA', 'optB', 'optC'],
  correct: 1,
  explanation: 'why',
});

describe('ExerciseWidget, multiple choice (v1.5)', () => {
  test('shows the options as radios and no numeric field', () => {
    render(<ExerciseWidget exercise={exercise} topicId="t" seed={1} />);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  test('asks for an option before grading, then explains a wrong answer', async () => {
    render(<ExerciseWidget exercise={exercise} topicId="t" seed={1} />);
    await userEvent.click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(screen.queryByTestId('exercise-explanation')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'optA' }));
    await userEvent.click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(screen.getByTestId('exercise-result')).toHaveTextContent('Incorrecto');
    expect(screen.getByTestId('exercise-explanation')).toHaveTextContent('why');
  });

  test('marks the right option correct', async () => {
    render(<ExerciseWidget exercise={exercise} topicId="t" seed={1} />);
    await userEvent.click(screen.getByRole('radio', { name: 'optB' }));
    await userEvent.click(screen.getByRole('button', { name: 'Comprobar' }));
    expect(screen.getByTestId('exercise-result')).toHaveTextContent('Correcto');
  });
});
