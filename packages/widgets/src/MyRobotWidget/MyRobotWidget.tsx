import { useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { format } from '../ParamPanel/ParamPanel';
import { Toast } from '../shared/Toast';
import { RobotCard } from './card';
import { FIELD_GROUPS, omegaMax_radps, vMax_mps } from './fields';
import type { RobotFieldGroup } from './fields';
import { RobotDiagram, isDrawn } from './RobotDiagram';
import { FieldRow } from './rows';
import { useMyRobotForm } from './state';
import type { MyRobotFormState } from './state';
import { useMyRobot } from './useMyRobot';

/** What the widget shows: the editable form or the read-only summary (#95, decisions 4 and 5). */
export type MyRobotMode = 'form' | 'card';

export interface MyRobotWidgetProps {
  mode: MyRobotMode;
  /** Where «Editar» of the card points; the account page by default. */
  editHref?: string;
  /**
   * Paths of the only fields the form shows (`wheelRadius_m`, `maxMotorSpeed_rpm`, …; see
   * `RobotField.key`). Without it the whole form shows. The name, the derived block and the
   * groups left empty are hidden; the fields not listed keep their saved value (v1.5).
   */
  fields?: readonly string[];
}

const BUTTON =
  'h-[44px] rounded-md border px-4 text-sm font-semibold transition-colors duration-[120ms]';
const PRIMARY = `${BUTTON} border-primary bg-primary text-primary-fg hover:bg-primary-hover`;
const GHOST = `${BUTTON} text-fg-muted hover:text-fg border-border bg-transparent`;

const GROUP_TITLE: Readonly<Record<RobotFieldGroup['id'], string>> = {
  chassis: 'groupChassis',
  drive: 'groupDrive',
  sensors: 'groupSensors',
  optional: 'groupOptional',
};

/** One group of fields; the optional block is folded because it is rarely edited (decision 4). */
function Group({
  group,
  form,
  t,
}: {
  group: RobotFieldGroup;
  form: MyRobotFormState;
  t: Translate;
}): JSX.Element {
  const title = t(`widgets.MyRobotWidget.${GROUP_TITLE[group.id]}`);
  const rows = (
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {group.fields.map((field) => (
        <FieldRow key={field.key} field={field} form={form} t={t} />
      ))}
    </div>
  );
  if (group.id === 'optional') {
    return (
      <details data-group={group.id} className="border-border mt-5 border-t pt-4">
        <summary className="cursor-pointer text-sm font-semibold">{title}</summary>
        {rows}
      </details>
    );
  }
  return (
    <fieldset data-group={group.id} className="mt-5">
      <legend className="text-sm font-semibold">{title}</legend>
      {rows}
    </fieldset>
  );
}

/** `ω_max` and `v_max`, read-only: they are derived from the spec, never stored (§1.1). */
function Derived({ form, t }: { form: MyRobotFormState; t: Translate }): JSX.Element | null {
  const mobile = form.robot.mobile;
  if (mobile === undefined) return null;
  const items = [
    { key: 'omegaMax', value: omegaMax_radps(mobile), unit: t('widgets.MyRobotWidget.unitRadps') },
    { key: 'vMax', value: vMax_mps(mobile), unit: t('widgets.MyRobotWidget.unitMps') },
  ];
  return (
    <section className="border-border mt-5 border-t pt-4">
      <h3 className="text-sm font-semibold">{t('widgets.MyRobotWidget.derived')}</h3>
      <dl className="mt-2 flex flex-wrap gap-6">
        {items.map(({ key, value, unit }) => (
          <div key={key}>
            <dt className="text-fg-muted text-xs">{t(`widgets.MyRobotWidget.${key}`)}</dt>
            <dd className="font-mono text-sm tabular-nums" data-testid={`derived-${key}`}>
              {format(Number(value.toFixed(3)))} {unit}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The one free-text field of the form: the name of the robot. */
function NameField({ form, t }: { form: MyRobotFormState; t: Translate }): JSX.Element {
  return (
    <label className="block">
      <span className="text-sm font-medium">{t('widgets.MyRobotWidget.name')}</span>
      <input
        type="text"
        className="border-border bg-bg text-fg rounded-sm mt-1 h-9 w-full border px-2 text-sm"
        value={form.name}
        onChange={(event) => {
          form.setName(event.target.value);
        }}
      />
    </label>
  );
}

/** «Guardar» (primary) and «Restablecer al robot de referencia» (ghost), per decision 4. */
function Actions({ form, t }: { form: MyRobotFormState; t: Translate }): JSX.Element {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <button type="submit" className={PRIMARY}>
        {t('widgets.MyRobotWidget.save')}
      </button>
      <button type="button" className={GHOST} onClick={form.reset}>
        {t('widgets.MyRobotWidget.reset')}
      </button>
    </div>
  );
}

/** The name and the groups of fields the form shows: all of them, or only those in `fields`. */
function Fields({
  form,
  fields,
  t,
}: {
  form: MyRobotFormState;
  fields: readonly string[] | undefined;
  t: Translate;
}): JSX.Element {
  const groups = FIELD_GROUPS.map((group) => ({
    ...group,
    fields: group.fields.filter((field) => fields === undefined || fields.includes(field.key)),
  })).filter((group) => group.fields.length > 0);
  return (
    <div>
      {fields === undefined ? <NameField form={form} t={t} /> : null}
      {groups.map((group) => (
        <Group key={group.id} group={group} form={form} t={t} />
      ))}
    </div>
  );
}

/** The drawing beside the fields; the field with the focus highlights its measure (v1.5). */
function Body({
  form,
  fields,
  t,
}: {
  form: MyRobotFormState;
  fields: readonly string[] | undefined;
  t: Translate;
}): JSX.Element {
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const drawn = fields === undefined || fields.some(isDrawn);
  return (
    <div
      onFocus={(event) => {
        setFocusedKey(event.target.closest<HTMLElement>('[data-field]')?.dataset.field ?? null);
      }}
      onBlur={() => {
        setFocusedKey(null);
      }}
    >
      {drawn ? (
        <div className="bg-bg-raised sticky top-0 z-10 pb-2">
          <RobotDiagram focusedKey={focusedKey} t={t} />
        </div>
      ) : null}
      <Fields form={form} fields={fields} t={t} />
    </div>
  );
}

/** The editable form of «Mi robot»: every field of `MobileSpec`, grouped (decision 4). */
function MyRobotForm({
  t,
  fields,
}: {
  t: Translate;
  fields?: readonly string[] | undefined;
}): JSX.Element {
  const form = useMyRobotForm({
    saved: t('widgets.MyRobotWidget.saved'),
    resetDone: t('widgets.MyRobotWidget.resetDone'),
    invalid: t('widgets.MyRobotWidget.invalid'),
  });
  return (
    <form
      className="bg-bg-raised border-border rounded-lg border p-6"
      data-testid="my-robot-form"
      aria-label={t('widgets.MyRobotWidget.formTitle')}
      onSubmit={(event) => {
        event.preventDefault();
        form.save();
      }}
    >
      <Body form={form} fields={fields} t={t} />
      {fields === undefined ? <Derived form={form} t={t} /> : null}
      <Actions form={form} t={t} />
      {form.notice === null ? null : (
        <Toast message={form.notice.message} tone={form.notice.tone} onClose={form.dismiss} />
      )}
    </form>
  );
}

/**
 * «Mi robot» (docs/WIDGETS.md, MyRobotWidget): the form that edits the one `RobotSpec` of the
 * learner, and the card that summarises it wherever a topic mentions it. Both read the same
 * store, so saving in the form updates every widget on the page (#95, decisions 4 to 6).
 */
export function MyRobotWidget({
  mode,
  editHref = '/cuenta',
  fields,
}: MyRobotWidgetProps): JSX.Element {
  const t = useT();
  const robot = useMyRobot();
  if (mode === 'card') return <RobotCard robot={robot} editHref={editHref} t={t} />;
  return <MyRobotForm t={t} fields={fields} />;
}
