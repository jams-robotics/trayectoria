import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { defineExercise } from '@trayectoria/sim-core';

import { ExerciseWidget } from './ExerciseWidget';

describe('ExerciseWidget labels (#629)', () => {
  test('labels name each field before it and in its aria-label (#629)', () => {
    // T1-1.2 e1: acceleration in m/s² and distance covered in m.
    const labelled = defineExercise({
      id: 'e1',
      generate: () => ({
        values: { v_mps: 0.5, t_s: 2 },
        answer: [0.25, 0.5],
        unit: ['m/s²', 'm'],
        labels: ['content.ruta-1/m01-t02.labels.e1.0', 'content.ruta-1/m01-t02.labels.e1.1'],
      }),
      statement: () => 'content.ruta-1/m01-t02.e1',
      tolerance: { type: 'relative', value: 0.02 },
    });
    render(<ExerciseWidget exercise={labelled} topicId="ruta-1/m01-t02" seed={1} />);

    const acceleration = screen.getByRole('textbox', { name: 'Aceleración en m/s²' });
    const distance = screen.getByRole('textbox', { name: 'Avance en m' });
    expect(acceleration.previousSibling).toHaveTextContent('Aceleración');
    expect(distance.previousSibling).toHaveTextContent('Avance');
    expect(screen.queryByRole('textbox', { name: /Componente/ })).toBeNull();
  });

  test('without labels a vector field keeps its number', () => {
    const numbered = defineExercise({
      id: 'e1',
      generate: () => ({ values: {}, answer: [1, 2], unit: ['m/s', 'm/s'] }),
      statement: () => 'widgets.ExerciseWidget.demo.components',
      tolerance: { type: 'relative', value: 0.02 },
    });
    render(<ExerciseWidget exercise={numbered} topicId="ruta-1/m00-t02" seed={1} />);

    expect(
      screen.getByRole('textbox', { name: 'Componente 1 en m/s' }).previousSibling,
    ).toHaveTextContent('1');
    expect(screen.getByRole('textbox', { name: 'Componente 2 en m/s' })).toBeInTheDocument();
  });
});
