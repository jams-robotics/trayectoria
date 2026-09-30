import { useEffect, useMemo, useState } from 'react';
import { check, createRng, format } from '@trayectoria/sim-core';
import type { Exercise } from '@trayectoria/sim-core';
import type { TParams } from '@trayectoria/i18n';

import { parseResponse } from './fields';
import type { ExerciseStatus } from './fields';
import { useProgressAdapter } from './progressAdapter';
import type { ProgressAdapter } from './progressAdapter';
import { randomSeed, seedFor } from './seed';

/** Significant figures of the statement values before interpolation (#94, decision 4). */
const STATEMENT_SIG_FIGS = 4;
/** Typographic minus sign of the statements (V-05, #475). */
const MINUS_SIGN = '−';

/**
 * A statement number rounded to 4 significant figures without padding zeros, negative ones with
 * «−» (V-05): a value drawn as 0.98 m/s reads `0.98`, never `0.9800` (#550).
 */
function statementNumber(value: number): string {
  const text = format(value, '', STATEMENT_SIG_FIGS);
  const trimmed = text.includes('.') && !text.includes('e') ? text.replace(/\.?0+$/, '') : text;
  return trimmed.replace(/^-/, MINUS_SIGN);
}

/**
 * Statement values rounded to 4 significant figures without padding zeros, ready to interpolate
 * (#94, decision 4; #550); negative numbers carry the minus sign U+2212 (V-05, #475).
 */
export function statementParams(values: unknown): TParams {
  if (typeof values !== 'object' || values === null) return {};
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === 'number' ? statementNumber(value) : String(value),
    ]),
  );
}

/** Graded outcome of the current instance; `null` until the first response is checked. */
interface Graded {
  correct: boolean;
  relError: number;
  /** Per-component verdict of the last check, so only the failing fields mark in error (#660). */
  componentCorrect: readonly boolean[] | undefined;
}

/** Drafts, validity and outcome of the response row. */
interface Responses {
  values: readonly string[];
  graded: Graded | null;
  attempt: number;
  invalid: boolean;
  /** True between pressing «Comprobar» and the adapter having recorded the attempt. */
  checking: boolean;
}

const EMPTY: Responses = { values: [], graded: null, attempt: 0, invalid: false, checking: false };

/** Everything the component renders and the two actions it offers. */
export interface ExerciseState {
  /** i18n key of the statement of the current instance. */
  statementKey: string;
  /** Values of the current instance, rounded and ready to interpolate. */
  params: TParams;
  status: ExerciseStatus;
  /** Unrounded relative error of the last graded response, or null before grading. Not shown to the
   * student (#533); it only travels in a data attribute for black-box e2e tests. */
  relativeError: number | null;
  attempt: number;
  invalid: boolean;
  /** Per-component verdict of the last check; `undefined` before grading or with a shape mismatch,
   * so the whole row falls back to the shared `status` (#660). */
  componentCorrect: readonly boolean[] | undefined;
  values: readonly string[];
  /** One unit for every field, or one per field (F1-10c). */
  unit: string | readonly string[];
  /** i18n keys naming each field, one per component (#629); `undefined` numbers the fields. */
  labels: readonly string[] | undefined;
  edit: (position: number, value: string) => void;
  verify: () => void;
  regenerate: () => void;
}

/** Unit of the field at `position`: the shared unit, or its own entry of a per-component list. */
export function unitAt(unit: string | readonly string[], position: number): string {
  return typeof unit === 'string' ? unit : (unit[position] ?? '');
}

/** The instance drawn for a seed: how many fields to show, in which unit and with which labels. */
function useInstance<V>(
  exercise: Exercise<V>,
  seed: number,
): { count: number; unit: string | readonly string[]; labels: readonly string[] | undefined } {
  return useMemo(() => {
    const { answer, unit, labels } = exercise.generate(createRng(seed));
    return { count: Array.isArray(answer) ? answer.length : 1, unit, labels };
  }, [exercise, seed]);
}

/** `pending` until a response is graded, `checking` while the adapter is still recording it. */
function statusOf({ checking, graded }: Responses): ExerciseStatus {
  if (checking) return 'checking';
  if (graded === null) return 'pending';
  return graded.correct ? 'correct' : 'incorrect';
}

/** Parses every field; `null` when any of them is empty or not a number (#94, decision 3). */
function parseAll(values: readonly string[]): readonly number[] | null {
  const parsed = values.map(parseResponse);
  return parsed.includes(null) ? null : parsed.filter((value) => value !== null);
}

/**
 * Seed of the instance in play and the way to move to the next one (#94, decision 2; #489): round
 * 0, the first instance, is always the same deterministic anonymous seed — with or without a
 * session — so the statement never redraws once the session settles. Only from round 1 on (after
 * «Nuevos valores») does a signed-in learner move to their derived per-user seed; without a
 * session every later round still draws a fresh random one, as before. `fixedSeed` overrides both
 * for stories, tests and e2e.
 *
 * The server never knows the session (there is no request-scoped adapter, #482), so it always
 * renders round 0's anonymous seed. Because that seed no longer depends on `sessionReady`/
 * `userId`, a `client:visible` island hydrating after the session has already settled elsewhere
 * on the page still commits the same instance on its first render — no mount/mismatch dance is
 * needed for round 0 any more.
 */
function useSeed(
  adapter: ProgressAdapter,
  topicId: string,
  exerciseId: string,
  fixedSeed: number | undefined,
): { seed: number; next: () => void } {
  const [round, setRound] = useState(0);
  const userId = adapter.sessionReady() ? adapter.userId() : null;
  const firstInstance = seedFor('', topicId, exerciseId, 0);
  // A random seed drawn while rendering would differ between the server pass and the client
  // bundle and discard the hydrated tree (docs/audits F2-01a), so a later anonymous round starts
  // from the same deterministic seed as round 0 and is redrawn in an effect right after mount,
  // and again on «Nuevos valores».
  const anonymous = round > 0 && userId === null && fixedSeed === undefined;
  const [mountSeed, setMountSeed] = useState<number | null>(null);
  useEffect(() => {
    if (anonymous) setMountSeed(randomSeed());
  }, [anonymous, round]);

  const derived = round === 0 ? firstInstance : seedFor(userId ?? '', topicId, exerciseId, round);
  const seed = fixedSeed ?? (anonymous ? (mountSeed ?? derived) : derived);
  const next = (): void => {
    setRound((current) => current + 1);
  };
  return { seed, next };
}

/** What `verify` needs from the hook to grade one response and report the attempt. */
interface Grading<V> {
  exercise: Exercise<V>;
  topicId: string;
  seed: number;
  count: number;
  adapter: ProgressAdapter;
  responses: Responses;
  values: readonly string[];
  setResponses: (responses: Responses) => void;
}

/**
 * Clears any previous outcome so only one message shows: a non-numeric submission never leaves
 * a stale «Incorrecto» next to «Escribe un número.» (#533).
 */
function invalidResponse(values: readonly string[], attempt: number): Responses {
  return { values, graded: null, attempt, invalid: true, checking: false };
}

/** Grades the drafts, reports the attempt and moves the row to its next state. */
function grade<V>(context: Grading<V>): void {
  const { exercise, topicId, seed, count, adapter, responses, values, setResponses } = context;
  const numbers = parseAll(values);
  if (numbers === null) {
    setResponses(invalidResponse(values, responses.attempt));
    return;
  }
  const outcome = check(exercise, seed, count === 1 ? (numbers[0] ?? Number.NaN) : numbers);
  const attempt = responses.attempt + 1;
  const settled: Responses = {
    values,
    graded: {
      correct: outcome.correct,
      relError: outcome.relError,
      componentCorrect: outcome.componentCorrect,
    },
    attempt,
    invalid: false,
    checking: false,
  };
  const { correct, relError } = outcome;
  const recorded = adapter.recordAttempt({
    topicId,
    exerciseId: exercise.id,
    seed,
    correct,
    relError,
    attempt,
  });
  // The null adapter records synchronously and the result shows at once; a real one (F3-01)
  // writes to Supabase, and the row stays in «verificando» until that write settles.
  if (recorded === undefined) {
    setResponses(settled);
    return;
  }
  const show = (): void => {
    setResponses(settled);
  };
  setResponses({ ...settled, checking: true });
  void recorded.then(show, show);
}

/** Assembles the public state from the instance and the response row (kept out of `useExercise`
 * to stay under the file's line-per-function budget). */
function buildState<V>(
  instance: ReturnType<typeof check<V>>,
  responses: Responses,
  rest: Pick<ExerciseState, 'values' | 'unit' | 'labels' | 'edit' | 'verify' | 'regenerate'>,
): ExerciseState {
  return {
    statementKey: instance.statementKey,
    params: statementParams(instance.values),
    status: statusOf(responses),
    relativeError: responses.graded?.relError ?? null,
    attempt: responses.attempt,
    invalid: responses.invalid,
    componentCorrect: responses.graded?.componentCorrect,
    ...rest,
  };
}

/**
 * State machine of one exercise instance: which seed is in play, the response drafts and the
 * graded outcome, plus the two actions of docs/DESIGN.md §5 («Comprobar», «Nuevos valores»).
 */
export function useExercise<V>(
  exercise: Exercise<V>,
  topicId: string,
  fixedSeed: number | undefined,
): ExerciseState {
  const adapter = useProgressAdapter();
  const { seed, next } = useSeed(adapter, topicId, exercise.id, fixedSeed);

  const { count, unit, labels } = useInstance(exercise, seed);
  const [responses, setResponses] = useState<Responses>(EMPTY);
  const values =
    responses.values.length === count ? responses.values : Array<string>(count).fill('');
  // A response of the wrong shape is never graded, so this only regenerates the instance.
  const instance = check(exercise, seed, []);

  const verify = (): void => {
    grade({ exercise, topicId, seed, count, adapter, responses, values, setResponses });
  };

  const regenerate = (): void => {
    next();
    setResponses(EMPTY);
  };

  const edit = (position: number, value: string): void => {
    setResponses({
      ...responses,
      values: values.map((old, at) => (at === position ? value : old)),
    });
  };

  return buildState(instance, responses, { values, unit, labels, edit, verify, regenerate });
}
