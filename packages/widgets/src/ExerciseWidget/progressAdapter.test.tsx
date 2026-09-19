import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import type { JSX } from 'react';

import { ProgressAdapterProvider, nullProgressAdapter, useProgressAdapter } from './progressAdapter';
import type { ProgressAdapter } from './progressAdapter';

const ATTEMPT = {
  topicId: 'ruta-1/m01-t01',
  exerciseId: 'e1',
  seed: 2,
  correct: true,
  relError: 0,
  attempt: 1,
} as const;

/** Prints the user the adapter in context reports, so the provider can be observed. */
function Probe(): JSX.Element {
  const adapter = useProgressAdapter();
  return <span data-testid="user">{adapter.userId() ?? 'anonymous'}</span>;
}

describe('progressAdapter (F2-10)', () => {
  test('the null adapter has no user and records nothing', () => {
    expect(nullProgressAdapter.userId()).toBeNull();
    expect(nullProgressAdapter.recordAttempt(ATTEMPT)).toBeUndefined();
  });

  test('without a provider the null adapter is in context', () => {
    render(<Probe />);

    expect(screen.getByTestId('user')).toHaveTextContent('anonymous');
  });

  test('the provider injects the adapter into everything below it', () => {
    const adapter: ProgressAdapter = { userId: () => 'user-1', recordAttempt: vi.fn() };

    render(
      <ProgressAdapterProvider adapter={adapter}>
        <Probe />
      </ProgressAdapterProvider>,
    );

    expect(screen.getByTestId('user')).toHaveTextContent('user-1');
  });
});
