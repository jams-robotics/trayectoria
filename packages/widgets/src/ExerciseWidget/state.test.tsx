import { render, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { JSX, ReactNode } from 'react';

import { trackTimeExercise } from './demo';
import { useExercise } from './state';
import { seedFor } from './seed';
import { ProgressAdapterProvider } from './progressAdapter';
import type { ProgressAdapter } from './progressAdapter';

const TOPIC_ID = 'ruta-1/m01-t01';
const EXERCISE_ID = 'e1';

function adapterOf(userId: string | null, sessionReady: boolean): ProgressAdapter {
  return { userId: () => userId, sessionReady: () => sessionReady, recordAttempt: () => undefined };
}

function wrapperFor(adapter: ProgressAdapter) {
  return function Wrapper({ children }: { children: ReactNode }): ReactNode {
    return <ProgressAdapterProvider adapter={adapter}>{children}</ProgressAdapterProvider>;
  };
}

/** Records every `params` snapshot `useExercise` computes, one push per render. */
function RenderLog({ log }: { log: Array<{ params: unknown }> }): JSX.Element {
  const state = useExercise(trackTimeExercise, TOPIC_ID, undefined);
  log.push({ params: state.params });
  return <span data-testid="statement">{JSON.stringify(state.params)}</span>;
}

describe('useExercise seed vs. session readiness (#482, #489)', () => {
  beforeEach(() => {
    // The anonymous branch of `useSeed` (`state.ts`) draws `mountSeed` from `Math.random()` in an
    // effect; pinned so it does not mask the seeds under test with two different random draws.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  test('with an already-resolved session, the first render and the render after mount agree', () => {
    // #489: the first instance (round 0) is the same deterministic anonymous seed for every
    // learner, with or without a session, so the statement never redraws once the session
    // settles. A `client:visible` island can hydrate after the session has already resolved
    // elsewhere on the page, so the adapter reports `sessionReady=true` and a real `userId` from
    // the very first render call `useExercise` makes; `useSeed` must still commit the same round-0
    // instance on that render and on every one after mount. `log` captures every render
    // `useExercise` produces, in order.
    const log: Array<{ params: unknown }> = [];
    const adapter = adapterOf('user-1', true);
    render(
      <ProgressAdapterProvider adapter={adapter}>
        <RenderLog log={log} />
      </ProgressAdapterProvider>,
    );

    const serverSeed = seedFor('', TOPIC_ID, EXERCISE_ID, 0);
    const serverParams = renderHook(() =>
      useExercise(trackTimeExercise, TOPIC_ID, serverSeed),
    ).result.current.params;

    expect(log[0]).toBeDefined();
    expect(log[0]?.params).toEqual(serverParams);
    // And the render after mount still matches: round 0 never moves to the per-user seed.
    expect(log.at(-1)?.params).toEqual(serverParams);
  });

  test('«Nuevos valores» moves a signed-in learner to their derived per-user seed', () => {
    const adapter = adapterOf('user-1', true);
    const hook = renderHook(() => useExercise(trackTimeExercise, TOPIC_ID, undefined), {
      wrapper: wrapperFor(adapter),
    });

    const firstParams = hook.result.current.params;
    hook.result.current.regenerate();
    hook.rerender();
    const secondParams = hook.result.current.params;

    const derivedSeed = seedFor('user-1', TOPIC_ID, EXERCISE_ID, 1);
    const derivedParams = renderHook(() =>
      useExercise(trackTimeExercise, TOPIC_ID, derivedSeed),
    ).result.current.params;

    expect(secondParams).not.toEqual(firstParams);
    expect(secondParams).toEqual(derivedParams);
  });

  test('while not ready, a signed-in and an anonymous learner derive the same params', () => {
    const anonymous = renderHook(() => useExercise(trackTimeExercise, TOPIC_ID, undefined), {
      wrapper: wrapperFor(adapterOf(null, false)),
    });
    const signedInNotReady = renderHook(() => useExercise(trackTimeExercise, TOPIC_ID, undefined), {
      wrapper: wrapperFor(adapterOf('user-1', false)),
    });

    expect(signedInNotReady.result.current.statementKey).toBe(
      anonymous.result.current.statementKey,
    );
    expect(signedInNotReady.result.current.params).toEqual(anonymous.result.current.params);
  });

  test('once ready, two renders of the same signed-in user derive the same instance', () => {
    const ready = adapterOf('user-1', true);

    const first = renderHook(() => useExercise(trackTimeExercise, TOPIC_ID, undefined), {
      wrapper: wrapperFor(ready),
    });
    const second = renderHook(() => useExercise(trackTimeExercise, TOPIC_ID, undefined), {
      wrapper: wrapperFor(ready),
    });

    expect(second.result.current.statementKey).toBe(first.result.current.statementKey);
    expect(second.result.current.params).toEqual(first.result.current.params);
  });
});
