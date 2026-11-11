import { useId } from 'react';
import type { JSX } from 'react';
import type { Choices, Exercise } from '@trayectoria/sim-core';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { AnswerField, ResultLine } from './fields';
import type { ExerciseStatus } from './fields';
import { unitAt, useExercise } from './state';
import type { ExerciseState } from './state';

// Button of docs/DESIGN.md §5, 44 px like its field: primary while the response is pending, ghost
// once it is correct (#540).
const BUTTON =
  'h-[44px] rounded-md border px-4 text-sm font-semibold transition-colors duration-[120ms]';
const PRIMARY = `${BUTTON} border-primary bg-primary text-primary-fg hover:bg-primary-hover`;
const GHOST = `${BUTTON} text-fg-muted hover:text-fg border-border bg-transparent`;
// «Nuevos valores»: tertiary, a borderless ghost at the end of the answer row (#540).
const TERTIARY =
  'text-fg-muted hover:text-fg ml-auto h-[44px] rounded-md px-3 text-sm font-semibold underline-offset-4 transition-colors duration-[120ms] hover:underline';

export interface ExerciseWidgetProps<V> {
  exercise: Exercise<V>;
  topicId: string;
  /** Required exercises count towards completing the topic (docs/CONTENT-STANDARDS.md §2). */
  required?: boolean;
  /** Position in the topic; paints the `E1`, `E2` prefix of docs/DESIGN.md §5. */
  index?: number;
  /** Fixes the instance, for stories, tests and e2e. Otherwise it comes from the session. */
  seed?: number;
}

/** Sentence the `aria-live` region announces after every check (docs/WIDGETS.md, reglas comunes). */
function announcement(state: ExerciseState, t: Translate): string {
  if (state.status === 'correct') return t('widgets.ExerciseWidget.correct');
  if (state.status !== 'incorrect') return '';
  const line = t('widgets.ExerciseWidget.incorrect');
  const hint = t('widgets.ExerciseWidget.hint');
  return `${line} · ${hint} · ${t('widgets.ExerciseWidget.attempt', { n: state.attempt })}`;
}

/** Statement of the instance, with the `E{n}` prefix and the «obligatorio» tag when they apply. */
function Statement({
  state,
  index,
  required,
  t,
}: {
  state: ExerciseState;
  index: number | undefined;
  required: boolean;
  t: Translate;
}): JSX.Element {
  return (
    <p className="text-fg flex flex-wrap items-baseline gap-2 text-base">
      {index === undefined ? null : (
        <span className="text-fg-muted font-mono text-xs">
          {t('widgets.ExerciseWidget.number', { n: index })}
        </span>
      )}
      <span data-testid="exercise-statement">{t(state.statementKey, state.params)}</span>
      {required ? (
        <span className="text-fg-muted text-xs">{t('widgets.ExerciseWidget.required')}</span>
      ) : null}
    </p>
  );
}

/**
 * Fixed help line under the statement, `sm` muted (docs/DESIGN.md §3): with relative 2 %, a
 * response with three significant figures always passes (#568).
 */
function PrecisionNote({ t }: { t: Translate }): JSX.Element {
  return (
    <p className="text-fg-muted mt-2 text-sm" data-testid="exercise-precision">
      {t('widgets.ExerciseWidget.precision')}
    </p>
  );
}

/**
 * This field's own status: with a per-component verdict, a field marks `incorrect` only when its
 * own component failed, and the passing ones stay `correct` (#660). Without one — pending,
 * checking, invalid shape — every field shares the row's status, as before.
 */
function fieldStatus(
  status: ExerciseStatus,
  componentCorrect: readonly boolean[] | undefined,
  position: number,
): ExerciseStatus {
  if (status !== 'incorrect' || componentCorrect === undefined) return status;
  return componentCorrect[position] === false ? 'incorrect' : 'correct';
}

/**
 * One numeric field per answer component, «Comprobar», the result and, at the end of the same
 * row, «Nuevos valores» as a tertiary action (docs/DESIGN.md §5, #540).
 */
function AnswerRow({ state, t }: { state: ExerciseState; t: Translate }): JSX.Element {
  const status: ExerciseStatus = state.status;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {state.values.map((value, position) => (
        <AnswerField
          key={position}
          index={position}
          count={state.values.length}
          value={value}
          unit={unitAt(state.unit, position)}
          label={state.labels?.[position]}
          status={fieldStatus(status, state.componentCorrect, position)}
          invalid={state.invalid}
          t={t}
          onChange={(next) => {
            state.edit(position, next);
          }}
        />
      ))}
      <button
        type="button"
        className={status === 'correct' ? GHOST : PRIMARY}
        disabled={status === 'checking'}
        onClick={state.verify}
      >
        {t('widgets.ExerciseWidget.verify')}
      </button>
      <ResultLine status={status} relativeError={state.relativeError} t={t} />
      <button type="button" className={TERTIARY} onClick={state.regenerate}>
        {t('widgets.ExerciseWidget.regenerate')}
      </button>
    </div>
  );
}

/** The options of a multiple-choice exercise as radios; the selected index is the answer text. */
function ChoiceOptions({
  state,
  choices,
  t,
}: {
  state: ExerciseState;
  choices: Choices;
  t: Translate;
}): JSX.Element {
  const name = useId();
  return (
    <fieldset className="m-0 grid gap-2 border-0 p-0">
      <legend className="sr-only">{t('widgets.ExerciseWidget.choices')}</legend>
      {choices.options.map((option, position) => (
        <label
          key={option}
          className="border-border hover:border-fg-muted flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm"
        >
          <input
            type="radio"
            name={name}
            className="mt-1"
            checked={state.values[0] === String(position)}
            disabled={state.status === 'checking'}
            onChange={() => {
              state.edit(0, String(position));
            }}
          />
          <span>{t(option)}</span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Multiple-choice exercise: options, «Comprobar», the result and, once answered, the
 * explanation (v1.5).
 */
function ChoiceRow({
  state,
  choices,
  t,
}: {
  state: ExerciseState;
  choices: Choices;
  t: Translate;
}): JSX.Element {
  const status: ExerciseStatus = state.status;
  return (
    <div className="mt-4">
      <ChoiceOptions state={state} choices={choices} t={t} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={status === 'correct' ? GHOST : PRIMARY}
          disabled={status === 'checking'}
          onClick={state.verify}
        >
          {t('widgets.ExerciseWidget.verify')}
        </button>
        <ResultLine status={status} relativeError={state.relativeError} t={t} />
      </div>
      {state.invalid ? (
        <p className="text-error mt-2 text-sm">{t('widgets.ExerciseWidget.chooseOne')}</p>
      ) : null}
      {status === 'correct' || status === 'incorrect' ? (
        <p className="text-fg-muted mt-2 text-sm" data-testid="exercise-explanation">
          {t(choices.explanation)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * One exercise of `defineExercise`: statement with the generated values, a numeric field per
 * answer component, verification with `check()` of sim-core and feedback (docs/WIDGETS.md,
 * ExerciseWidget; states and texts of docs/DESIGN.md §5, Ejercicio).
 *
 * Attempts are reported to the injected `ProgressAdapter`, the null one until F3-01.
 */
export function ExerciseWidget<V>({
  exercise,
  topicId,
  required = false,
  index,
  seed,
}: ExerciseWidgetProps<V>): JSX.Element {
  const t = useT();
  const state = useExercise(exercise, topicId, seed);

  return (
    <section
      className="bg-bg-raised border-border rounded-lg border p-6"
      data-testid="exercise"
      data-status={state.status}
      aria-label={t('widgets.ExerciseWidget.title')}
    >
      <Statement state={state} index={index} required={required} t={t} />
      {exercise.choices === undefined ? <PrecisionNote t={t} /> : null}
      {exercise.choices === undefined ? <AnswerRow state={state} t={t} /> : <ChoiceRow state={state} choices={exercise.choices} t={t} />}
      {state.invalid && exercise.choices === undefined ? (
        <p className="text-error mt-2 text-sm">{t('widgets.ExerciseWidget.invalid')}</p>
      ) : null}
      {state.status === 'incorrect' && exercise.choices === undefined ? (
        <p className="text-fg-muted mt-2 text-sm">
          <span data-testid="exercise-hint">{t('widgets.ExerciseWidget.hint')}</span>
          {' · '}
          <span data-testid="exercise-attempt">
            {t('widgets.ExerciseWidget.attempt', { n: state.attempt })}
          </span>
        </p>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement(state, t)}
      </p>
    </section>
  );
}
