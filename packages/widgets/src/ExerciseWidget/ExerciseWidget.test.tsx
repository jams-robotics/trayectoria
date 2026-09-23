import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { defineExercise } from '@trayectoria/sim-core';

import { ExerciseWidget } from './ExerciseWidget';
import { statementParams } from './state';
import { componentsExercise, trackTimeExercise } from './demo';
import { ProgressAdapterProvider, nullProgressAdapter } from './progressAdapter';
import type { ExerciseAttempt, ProgressAdapter } from './progressAdapter';

// Instances of the demo exercises for the story seeds (#94, decisions 6 and 7), recomputed by
// hand from the generator: `D / v` for the scalar and `v·cosθ`, `v·sinθ` for the vector.
const SCALAR_SEED = 2;
const SCALAR_ANSWER_S = 7.608258 / 0.392499;
const VECTOR_SEED = 5;
const VECTOR_VX_MPS = 0.372394;
const VECTOR_VY_MPS = 0.998503;

const TOPIC_ID = 'ruta-1/m01-t01';

function renderScalar(adapter: ProgressAdapter = nullProgressAdapter): void {
  render(
    <ProgressAdapterProvider adapter={adapter}>
      <ExerciseWidget
        exercise={trackTimeExercise}
        topicId={TOPIC_ID}
        index={1}
        required
        seed={SCALAR_SEED}
      />
    </ProgressAdapterProvider>,
  );
}

/** The single numeric field of a scalar exercise. */
function scalarField(): HTMLElement {
  return screen.getByRole('textbox', { name: /respuesta/i });
}

function verifyButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Comprobar' });
}

/** The visible result line, apart from the same sentence in the `aria-live` region. */
function result(): HTMLElement {
  return screen.getByTestId('exercise-result');
}

describe('ExerciseWidget (F2-10)', () => {
  test('a response inside the 2 % tolerance is correct (1.019·x)', async () => {
    const user = userEvent.setup();
    renderScalar();

    await user.type(scalarField(), String(1.019 * SCALAR_ANSWER_S));
    await user.click(verifyButton());

    expect(result()).toHaveTextContent('Correcto');
    expect(screen.getByTestId('exercise')).toHaveAttribute('data-status', 'correct');
  });

  test('a response outside the 2 % tolerance is incorrect (1.021·x) and shows the error', async () => {
    const user = userEvent.setup();
    renderScalar();

    await user.type(scalarField(), String(1.021 * SCALAR_ANSWER_S));
    await user.click(verifyButton());

    expect(result()).toHaveTextContent('Incorrecto · fuera por 2.1 %');
    expect(screen.getByText('Intento 1')).toBeInTheDocument();
    expect(screen.getByTestId('exercise')).toHaveAttribute('data-status', 'incorrect');
  });

  test('counts attempts without limit and keeps the statement between them', async () => {
    const user = userEvent.setup();
    renderScalar();
    const statement = screen.getByTestId('exercise-statement').textContent;

    for (const attempt of [1, 2, 3]) {
      await user.clear(scalarField());
      await user.type(scalarField(), String(1.1 * SCALAR_ANSWER_S));
      await user.click(verifyButton());
      expect(screen.getByText(`Intento ${String(attempt)}`)).toBeInTheDocument();
    }

    expect(result()).toHaveTextContent('Incorrecto · fuera por 10.0 %');
    expect(screen.getByTestId('exercise-statement')).toHaveTextContent(statement ?? '');
  });

  test('accepts a comma as the decimal separator', async () => {
    const user = userEvent.setup();
    renderScalar();

    await user.type(scalarField(), String(SCALAR_ANSWER_S).replace('.', ','));
    await user.click(verifyButton());

    expect(result()).toHaveTextContent('Correcto');
  });

  test('an empty or non numeric response is a validation error and is not an attempt', async () => {
    const user = userEvent.setup();
    const recordAttempt = vi.fn();
    renderScalar({ userId: () => null, recordAttempt });

    await user.click(verifyButton());
    expect(screen.getByText('Escribe un número.')).toBeInTheDocument();
    expect(scalarField()).toHaveAttribute('aria-invalid', 'true');

    await user.type(scalarField(), 'abc');
    await user.click(verifyButton());
    expect(screen.getByText('Escribe un número.')).toBeInTheDocument();

    expect(recordAttempt).not.toHaveBeenCalled();
    expect(screen.queryByText(/Intento/)).not.toBeInTheDocument();
  });

  test('«Nuevos valores» draws a new instance and resets the attempt counter', async () => {
    const user = userEvent.setup();
    render(<ExerciseWidget exercise={trackTimeExercise} topicId={TOPIC_ID} />);
    const before = screen.getByTestId('exercise-statement').textContent;

    await user.type(scalarField(), '1');
    await user.click(verifyButton());
    expect(screen.getByText('Intento 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nuevos valores' }));

    expect(screen.getByTestId('exercise')).toHaveAttribute('data-status', 'pending');
    expect(screen.queryByText(/Intento/)).not.toBeInTheDocument();
    expect(scalarField()).toHaveValue('');
    expect(screen.getByTestId('exercise-statement').textContent).not.toBe(before);
  });

  test('with a session the statement is stable per round and changes with «Nuevos valores»', async () => {
    const user = userEvent.setup();
    const adapter: ProgressAdapter = { userId: () => 'user-1', recordAttempt: vi.fn() };
    const view = (
      <ProgressAdapterProvider adapter={adapter}>
        <ExerciseWidget exercise={trackTimeExercise} topicId={TOPIC_ID} />
      </ProgressAdapterProvider>
    );
    const { unmount } = render(view);
    const first = screen.getByTestId('exercise-statement').textContent;
    unmount();

    render(view);
    expect(screen.getByTestId('exercise-statement')).toHaveTextContent(first ?? '');

    await user.click(screen.getByRole('button', { name: 'Nuevos valores' }));
    expect(screen.getByTestId('exercise-statement').textContent).not.toBe(first);
  });

  test('reports every graded response to the adapter, and nothing else', async () => {
    const user = userEvent.setup();
    const attempts: ExerciseAttempt[] = [];
    renderScalar({
      userId: () => null,
      recordAttempt: (attempt) => {
        attempts.push(attempt);
      },
    });

    await user.type(scalarField(), '1');
    await user.click(verifyButton());
    await user.clear(scalarField());
    await user.type(scalarField(), String(SCALAR_ANSWER_S));
    await user.click(verifyButton());

    const withoutError = attempts.map(({ topicId, exerciseId, seed, correct, attempt }) => ({
      topicId,
      exerciseId,
      seed,
      correct,
      attempt,
    }));
    expect(withoutError).toEqual([
      { topicId: TOPIC_ID, exerciseId: 'e1', seed: SCALAR_SEED, correct: false, attempt: 1 },
      { topicId: TOPIC_ID, exerciseId: 'e1', seed: SCALAR_SEED, correct: true, attempt: 2 },
    ]);
    // A response of 1 s against 19.38 s: |1 - 19.38| / 19.38 = 0.9484.
    expect(attempts[0]?.relError).toBeCloseTo(0.9484, 4);
    expect(attempts[1]?.relError).toBeCloseTo(0, 5);
  });

  test('shows «Verificando…» while an asynchronous adapter records the attempt', async () => {
    const user = userEvent.setup();
    let settle = (): void => undefined;
    const recordAttempt = (): Promise<void> =>
      new Promise<void>((resolve) => {
        settle = resolve;
      });
    renderScalar({ userId: () => null, recordAttempt });

    await user.type(scalarField(), String(SCALAR_ANSWER_S));
    await user.click(verifyButton());

    expect(result()).toHaveTextContent('Verificando…');
    expect(verifyButton()).toBeDisabled();

    settle();
    await waitFor(() => {
      expect(result()).toHaveTextContent('Correcto');
    });
  });

  test('a vector answer shows one field per component and grades the worst one', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseWidget exercise={componentsExercise} topicId="ruta-1/m00-t02" seed={VECTOR_SEED} />,
    );

    const first = screen.getByRole('textbox', { name: 'Componente 1 en m/s' });
    const second = screen.getByRole('textbox', { name: 'Componente 2 en m/s' });
    await user.type(first, String(VECTOR_VX_MPS));
    await user.type(second, String(1.1 * VECTOR_VY_MPS));
    await user.click(verifyButton());
    expect(result()).toHaveTextContent('Incorrecto · fuera por 10.0 %');

    await user.clear(second);
    await user.type(second, String(VECTOR_VY_MPS));
    await user.click(verifyButton());
    expect(result()).toHaveTextContent('Correcto');
  });

  test('a unit per component shows each field with its own unit (F1-10c)', async () => {
    // T-0.2 e2 of docs/CURRICULUM.md: magnitude in m/s and angle in degrees (#259).
    const magnitudeAngle = defineExercise({
      id: 'e2',
      generate: () => ({
        values: { speed_mps: 0.5, angle_deg: 53.13 },
        answer: [0.5, 53.13],
        unit: ['m/s', '°'],
      }),
      statement: () => 'widgets.ExerciseWidget.demo.components',
      tolerance: [
        { type: 'relative', value: 0.02 },
        { type: 'absolute', value: 0.5 },
      ],
    });
    const user = userEvent.setup();
    render(<ExerciseWidget exercise={magnitudeAngle} topicId="ruta-1/m00-t02" seed={1} />);

    const magnitude = screen.getByRole('textbox', { name: 'Componente 1 en m/s' });
    const angle = screen.getByRole('textbox', { name: 'Componente 2 en °' });
    expect(magnitude.nextSibling).toHaveTextContent('m/s');
    expect(angle.nextSibling).toHaveTextContent('°');
    await user.type(magnitude, '0.5');
    await user.type(angle, '53.13');
    await user.click(verifyButton());
    expect(result()).toHaveTextContent('Correcto');
  });

  test('the statement, the E prefix and the required tag come from i18n keys', () => {
    renderScalar();

    expect(screen.getByText('E1')).toBeInTheDocument();
    expect(screen.getByText('obligatorio')).toBeInTheDocument();
    // Values rounded to 4 significant figures before interpolation (#94, decision 4).
    expect(screen.getByTestId('exercise-statement')).toHaveTextContent('7.608 m');
    expect(screen.getByTestId('exercise-statement')).toHaveTextContent('0.3925 m/s');
  });

  test('announces the result in the `aria-live` region', async () => {
    const user = userEvent.setup();
    renderScalar();
    const live = screen.getByRole('status');
    expect(live).toHaveTextContent('');

    await user.type(scalarField(), String(1.1 * SCALAR_ANSWER_S));
    await user.click(verifyButton());

    expect(live).toHaveTextContent('Incorrecto · fuera por 10.0 % · Intento 1');
  });
});

describe('statementParams (F2-10)', () => {
  test('rounds numbers to 4 significant figures and leaves other values as text', () => {
    expect(statementParams({ distance_m: 7.608258, label: 'pista' })).toEqual({
      distance_m: '7.608',
      label: 'pista',
    });
  });

  test('ignores values that are not an object', () => {
    expect(statementParams(null)).toEqual({});
    expect(statementParams(3)).toEqual({});
  });
});
