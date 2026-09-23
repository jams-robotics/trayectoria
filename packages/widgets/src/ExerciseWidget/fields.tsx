import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

/** Where a response is in its life cycle (docs/DESIGN.md §5, Ejercicio). */
export type ExerciseStatus = 'pending' | 'checking' | 'correct' | 'incorrect';

// Numeric field of docs/DESIGN.md §5: mono, tabular-nums, 40 px high, unit as a muted suffix.
const FIELD_BASE =
  'bg-bg text-fg h-10 w-12 rounded-sm border px-2 text-right font-mono text-sm tabular-nums';
const FIELD_BORDER: Readonly<Record<ExerciseStatus | 'invalid', string>> = {
  pending: 'border-border',
  checking: 'border-border',
  correct: 'border-success',
  incorrect: 'border-error',
  invalid: 'border-error',
};

/** Parses a response allowing both decimal separators; `null` when it is empty or not a number. */
export function parseResponse(raw: string): number | null {
  const trimmed = raw.replace(',', '.').trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export interface AnswerFieldProps {
  /** Index of the component, 0 for a scalar answer. */
  index: number;
  /** Total number of components: 1 for a scalar answer. */
  count: number;
  value: string;
  unit: string;
  status: ExerciseStatus;
  invalid: boolean;
  onChange: (value: string) => void;
  t: Translate;
}

/** One numeric field with its unit; vector answers render one per component (#94, decision 3). */
export function AnswerField({
  index,
  count,
  value,
  unit,
  status,
  invalid,
  onChange,
  t,
}: AnswerFieldProps): JSX.Element {
  const label =
    count === 1
      ? t('widgets.ExerciseWidget.answer', { unit })
      : t('widgets.ExerciseWidget.component', { index: index + 1, unit });
  return (
    <span className="flex items-center gap-1">
      {count === 1 ? null : (
        <span className="text-fg-muted font-mono text-xs">
          {t('widgets.ExerciseWidget.componentShort', { index: index + 1 })}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        className={`${FIELD_BASE} ${FIELD_BORDER[invalid ? 'invalid' : status]}`}
        value={value}
        aria-label={label}
        aria-invalid={invalid}
        disabled={status === 'checking'}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      {unit === '' ? null : <span className="text-fg-muted font-mono text-xs">{unit}</span>}
    </span>
  );
}

/** Round glyph of the result, `success` or `error` (docs/DESIGN.md §5, Ejercicio). */
function ResultGlyph({ correct }: { correct: boolean }): JSX.Element {
  const tone = correct ? 'bg-success text-bg-raised' : 'bg-error text-bg-raised';
  return (
    <span
      aria-hidden="true"
      className={`${tone} flex h-5 w-5 items-center justify-center rounded-full text-xs`}
    >
      {correct ? '✓' : '✕'}
    </span>
  );
}

export interface ResultLineProps {
  status: ExerciseStatus;
  /** Relative error of the last graded response, as a percentage already rounded to 1 decimal. */
  errorPercent: string;
  t: Translate;
}

/** «Correcto» or «Incorrecto · fuera por X %» next to the button (docs/DESIGN.md §5). */
export function ResultLine({ status, errorPercent, t }: ResultLineProps): JSX.Element | null {
  if (status === 'checking') {
    return (
      <span className="text-fg-muted text-sm" data-testid="exercise-result">
        {t('widgets.ExerciseWidget.checking')}
      </span>
    );
  }
  if (status !== 'correct' && status !== 'incorrect') return null;
  const correct = status === 'correct';
  return (
    <span
      data-testid="exercise-result"
      className={`flex items-center gap-2 text-sm font-semibold ${correct ? 'text-success' : 'text-error'}`}
    >
      <ResultGlyph correct={correct} />
      {correct
        ? t('widgets.ExerciseWidget.correct')
        : t('widgets.ExerciseWidget.incorrect', { percent: errorPercent })}
    </span>
  );
}
