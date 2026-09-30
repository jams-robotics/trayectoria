import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { ExerciseWidget } from './ExerciseWidget';
import { componentsExercise, trackTimeExercise } from './demo';

const TOPIC_ID = 'ruta-1/m01-t01';

describe('ExerciseWidget: una sola fila de respuesta (#540)', () => {
  test('campo, «Comprobar» y «Nuevos valores» comparten fila y los tres miden 44 px de alto', () => {
    render(<ExerciseWidget exercise={trackTimeExercise} topicId={TOPIC_ID} seed={2} />);
    const field = screen.getByRole('textbox', { name: /respuesta/i });
    const verify = screen.getByRole('button', { name: 'Comprobar' });
    const regenerate = screen.getByRole('button', { name: 'Nuevos valores' });

    const row = verify.parentElement;
    expect(row).not.toBeNull();
    expect(row).toContainElement(field);
    expect(row).toContainElement(regenerate);
    for (const control of [field, verify, regenerate]) expect(control).toHaveClass('h-[44px]');
  });

  test('«Nuevos valores» es terciario: sin borde, en muted y al final de la fila', () => {
    render(<ExerciseWidget exercise={componentsExercise} topicId={TOPIC_ID} seed={5} />);
    const regenerate = screen.getByRole('button', { name: 'Nuevos valores' });
    const verify = screen.getByRole('button', { name: 'Comprobar' });

    expect(regenerate).toHaveClass('text-fg-muted', 'ml-auto');
    expect(regenerate).not.toHaveClass('border');
    expect(verify).toHaveClass('bg-primary');
    expect(regenerate.parentElement?.lastElementChild).toBe(regenerate);
  });
});
