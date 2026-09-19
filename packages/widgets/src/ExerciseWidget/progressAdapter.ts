import { createContext, createElement, useContext } from 'react';
import type { JSX, ReactNode } from 'react';

/** One graded response, as the widget reports it after every check (#94, decision 1). */
export interface ExerciseAttempt {
  readonly topicId: string;
  readonly exerciseId: string;
  /** Seed of the instance that was graded, so the attempt can be regenerated later. */
  readonly seed: number;
  readonly correct: boolean;
  /** Relative error of the response, as `check()` of sim-core reports it. */
  readonly relError: number;
  /** 1 for the first response to this instance, and up from there. */
  readonly attempt: number;
}

/**
 * How the widget reaches the session and the attempt store. `packages/widgets` may not import
 * `@trayectoria/auth` or `@trayectoria/progress` (dependency rule of `eslint.config.js`), so the
 * real adapter is injected by `apps/web` in F3-01; until then the null one is in place.
 */
export interface ProgressAdapter {
  /** Id of the signed-in learner, or `null` when there is no session. */
  userId: () => string | null;
  recordAttempt: (attempt: ExerciseAttempt) => void | Promise<void>;
}

/** No session and no persistence: what an anonymous learner gets (and the default). */
export const nullProgressAdapter: ProgressAdapter = {
  userId: () => null,
  recordAttempt: () => undefined,
};

const ProgressAdapterContext = createContext<ProgressAdapter>(nullProgressAdapter);

export interface ProgressAdapterProviderProps {
  adapter: ProgressAdapter;
  children: ReactNode;
}

/** Injects the adapter every `ExerciseWidget` below it uses. */
export function ProgressAdapterProvider({
  adapter,
  children,
}: ProgressAdapterProviderProps): JSX.Element {
  return createElement(ProgressAdapterContext.Provider, { value: adapter }, children);
}

/** The injected adapter, or the null one when nothing was injected. */
export function useProgressAdapter(): ProgressAdapter {
  return useContext(ProgressAdapterContext);
}
