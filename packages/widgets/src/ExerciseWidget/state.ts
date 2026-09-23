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
const PERCENT_DECIMALS = 1;

/** Statement values rounded to 4 significant figures, ready to interpolate (#94, decision 4). */
export function statementParams(values: unknown): TParams {
  if (typeof values !== 'object' || values === null) return {};
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === 'number' ? format(value, '', STATEMENT_SIG_FIGS) : String(value),
    ]),
  );
}

/** Graded outcome of the current instance; `null` until the first response is checked. */
interface Graded {
  correct: boolean;
  relError: number;
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
  /** Relative error of the last graded response as a percentage, to 1 decimal. */
  percent: string;
  attempt: number;
  invalid: boolean;
  values: readonly string[];
  /** One unit for every field, or one per field (F1-10c). */
  unit: string | readonly string[];
  edit: (position: number, value: string) => void;
  verify: () => void;
  regenerate: () => void;
}

/** Unit of the field at `position`: the shared unit, or its own entry of a per-component list. */
export function unitAt(unit: string | readonly string[], position: number): string {
  return typeof unit === 'string' ? unit : (unit[position] ?? '');
}

/** The instance drawn for a seed: how many fields to show and in which unit. */
function useInstance<V>(
  exercise: Exercise<V>,
  seed: number,
): { count: number; unit: string | readonly string[] } {
  return useMemo(() => {
    const { answer, unit } = exercise.generate(createRng(seed));
    return { count: Array.isArray(answer) ? answer.length : 1, unit };
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
 * Seed of the instance in play and the way to move to the next one (#94, decision 2): derived
 * from the session while there is one, drawn at random per mount when there is not, and fixed
 * when the caller passes `fixedSeed`.
 */
function useSeed(
  userId: string | null,
  topicId: string,
  exerciseId: string,
  fixedSeed: number | undefined,
): { seed: number; next: () => void } {
  const [round, setRound] = useState(0);
  // A random seed drawn while rendering would differ between the server pass and the client
  // bundle and discard the hydrated tree (docs/audits F2-01a), so the anonymous instance starts
  // from the deterministic seed of round 0 and is redrawn in an effect right after hydration,
  // and again on «Nuevos valores».
  const anonymous = userId === null && fixedSeed === undefined;
  const [mountSeed, setMountSeed] = useState<number | null>(null);
  useEffect(() => {
    if (anonymous) setMountSeed(randomSeed());
  }, [anonymous]);

  const derived = seedFor(userId ?? '', topicId, exerciseId, round);
  const seed = fixedSeed ?? (userId === null ? (mountSeed ?? derived) : derived);
  const next = (): void => {
    if (anonymous) setMountSeed(randomSeed());
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

/** Grades the drafts, reports the attempt and moves the row to its next state. */
function grade<V>(context: Grading<V>): void {
  const { exercise, topicId, seed, count, adapter, responses, values, setResponses } = context;
  const numbers = parseAll(values);
  if (numbers === null) {
    setResponses({ ...responses, values, invalid: true });
    return;
  }
  const outcome = check(exercise, seed, count === 1 ? (numbers[0] ?? Number.NaN) : numbers);
  const attempt = responses.attempt + 1;
  const settled: Responses = {
    values,
    graded: { correct: outcome.correct, relError: outcome.relError },
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
  const { seed, next } = useSeed(adapter.userId(), topicId, exercise.id, fixedSeed);

  const { count, unit } = useInstance(exercise, seed);
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

  return {
    statementKey: instance.statementKey,
    params: statementParams(instance.values),
    status: statusOf(responses),
    percent: ((responses.graded?.relError ?? 0) * 100).toFixed(PERCENT_DECIMALS),
    attempt: responses.attempt,
    invalid: responses.invalid,
    values,
    unit,
    edit,
    verify,
    regenerate,
  };
}
