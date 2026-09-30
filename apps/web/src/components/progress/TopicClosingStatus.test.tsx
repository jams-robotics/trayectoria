// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// No session and nothing remote: the tally must follow the local store alone (#546).
vi.mock('@trayectoria/auth', () => ({
  useSession: () => ({ session: null, ready: true }),
}));

const { progressAdapterFor } = await import('@trayectoria/progress');
const { TopicClosingStatus } = await import('./TopicClosingStatus');

// Same topic and exercises as the QA finding on PR #661: `ruta-1/m00-t01`, e1-e4.
const TOPIC_ID = 'ruta-1/m00-t01';
const EXERCISE_IDS = ['e1', 'e2', 'e3', 'e4'] as const;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function tally(): string | null | undefined {
  return container.querySelector('[data-testid="closing-exercises"]')?.textContent;
}

/** Records a right answer through the same adapter the Verifica islands inject. */
async function answerRight(exerciseId: string): Promise<void> {
  const adapter = progressAdapterFor(['e1', 'e2', 'e3']);
  await act(async () => {
    await adapter.recordAttempt({
      topicId: TOPIC_ID,
      exerciseId,
      seed: 1,
      correct: true,
      relError: 0,
      attempt: 1,
    });
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe('TopicClosingStatus (#546)', () => {
  test('the tally follows each answer recorded by Verifica without remounting', async () => {
    act(() => {
      root.render(<TopicClosingStatus topicId={TOPIC_ID} exerciseIds={EXERCISE_IDS} />);
    });
    const paragraph = container.querySelector('[data-testid="closing-exercises"]');
    expect(tally()).toBe('Ejercicios: 0 de 4 correctos');

    await answerRight('e1');
    expect(tally()).toBe('Ejercicios: 1 de 4 correctos');

    await answerRight('e2');
    expect(tally()).toBe('Ejercicios: 2 de 4 correctos');
    // Same node: the island re-rendered in place, it was not mounted again.
    expect(container.querySelector('[data-testid="closing-exercises"]')).toBe(paragraph);
  });
});
