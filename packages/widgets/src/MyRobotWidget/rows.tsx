import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import type { RobotField } from './fields';
import type { MyRobotFormState } from './state';

const FIELD =
  'border-border bg-bg text-fg rounded-sm h-9 w-full border px-2 text-right font-mono text-sm tabular-nums';

/** i18n key of a field label: the dotted path with `.` swapped for `_` (i18next splits on `.`). */
export function labelKey(path: string): string {
  return `widgets.MyRobotWidget.labels.${path.replace(/\./g, '_')}`;
}

interface FieldTexts {
  readonly heading: string;
  readonly ariaLabel: string;
}

/** Visible heading and accessible name of a field: the label with its unit as a suffix. */
function textsOf(field: RobotField, t: Translate): FieldTexts {
  const label = t(labelKey(field.key));
  if (field.unit === '') return { heading: label, ariaLabel: label };
  const params = { label, unit: field.unit };
  return {
    heading: t('widgets.MyRobotWidget.field', params),
    ariaLabel: t('widgets.MyRobotWidget.fieldValue', params),
  };
}

/**
 * One numeric field of the form: label with its unit as a suffix, the value, and the message
 * `parseRobotSpec` reported for it (#95, decision 4). The field is validated on blur.
 */
export function FieldRow({
  field,
  form,
  t,
}: {
  field: RobotField;
  form: MyRobotFormState;
  t: Translate;
}): JSX.Element {
  const { heading, ariaLabel } = textsOf(field, t);
  const error = form.errors[field.key];
  const errorId = `my-robot-error-${field.key.replace(/\./g, '-')}`;
  return (
    <label className="block" data-field={field.key}>
      <span className="text-fg-muted text-xs">{heading}</span>
      <input
        type="text"
        inputMode="decimal"
        className={FIELD}
        value={form.draft[field.key] ?? ''}
        aria-label={ariaLabel}
        aria-invalid={error !== undefined}
        aria-describedby={error === undefined ? undefined : errorId}
        onChange={(event) => {
          form.editField(field.key, event.target.value);
        }}
        onBlur={() => {
          form.blurField(field.key);
        }}
      />
      {error === undefined ? null : (
        <span id={errorId} className="text-error mt-1 block text-xs" data-testid="field-error">
          {error}
        </span>
      )}
    </label>
  );
}
