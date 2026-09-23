import type { JSX } from 'react';
import type { Exercise } from '@trayectoria/sim-core';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { AnswerField, ResultLine } from './fields';
import type { ExerciseStatus } from './fields';
import { unitAt, useExercise } from './state';
import type { ExerciseState } from './state';

// Button of docs/DESIGN.md §5: primary while the response is pending, ghost once it is correct.
const BUTTON =
  'h-11 rounded-md border px-4 text-sm font-semibold transition-colors duration-[120ms]';
const PRIMARY = `${BUTTON} border-primary bg-primary text-primary-fg hover:bg-primary-hover`;
const GHOST = `${BUTTON} text-fg-muted hover:text-fg border-border bg-transparent`;

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
  const line = t('widgets.ExerciseWidget.incorrect', { percent: state.percent });
  return `${line} · ${t('widgets.ExerciseWidget.attempt', { n: state.attempt })}`;
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

/** One numeric field per answer component, «Comprobar» and the result (docs/DESIGN.md §5). */
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
          status={status}
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
      <ResultLine status={status} errorPercent={state.percent} t={t} />
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
      <AnswerRow state={state} t={t} />
      {state.invalid ? (
        <p className="text-error mt-2 text-sm">{t('widgets.ExerciseWidget.invalid')}</p>
      ) : null}
      {state.status === 'incorrect' ? (
        <p className="text-fg-muted mt-2 text-sm" data-testid="exercise-attempt">
          {t('widgets.ExerciseWidget.attempt', { n: state.attempt })}
        </p>
      ) : null}
      <button type="button" className={`${GHOST} mt-4`} onClick={state.regenerate}>
        {t('widgets.ExerciseWidget.regenerate')}
      </button>
      <p className="sr-only" role="status" aria-live="polite">
        {announcement(state, t)}
      </p>
    </section>
  );
}
