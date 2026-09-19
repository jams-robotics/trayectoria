import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { JSX } from 'react';

import { emptyProgress } from './model';

vi.mock('./remote', () => ({
  fetchProgress: vi.fn().mockResolvedValue({}),
  upsertProgress: vi.fn().mockResolvedValue(undefined),
  insertAttempt: vi.fn().mockResolvedValue(undefined),
}));

const { useProgress, useTopicProgress } = await import('./useProgress');
const { markCompleted, resetProgressForTest, seedStoredProgressForTest } = await import(
  './stores/progress'
);

const TOPIC = 'ruta-1/m00-t01';

function Counter(): JSX.Element {
  const map = useProgress();
  const topic = useTopicProgress(TOPIC);
  return (
    <p data-testid="state">
      {Object.keys(map).length} · {topic?.status ?? 'none'}
    </p>
  );
}

beforeEach(() => {
  resetProgressForTest();
});

describe('useProgress (F3-01)', () => {
  test('adopts the stored map after hydration', () => {
    seedStoredProgressForTest({ [TOPIC]: { ...emptyProgress(), status: 'completed' } });

    render(<Counter />);

    expect(screen.getByTestId('state')).toHaveTextContent('1 · completed');
  });

  test('re-renders when a topic is completed', async () => {
    render(<Counter />);
    expect(screen.getByTestId('state')).toHaveTextContent('0 · none');

    await act(async () => {
      await markCompleted(TOPIC);
    });

    expect(screen.getByTestId('state')).toHaveTextContent('1 · completed');
  });
});
