import { signUp, type UserRole } from '@trayectoria/auth';
import { useT, type Translate } from '@trayectoria/i18n';
import { useState, type JSX, type SubmitEvent } from 'react';

import {
  absoluteUrl,
  EmailPasswordFields,
  FormFooter,
  FormStatus,
  goTo,
  SubmitButton,
  TextField,
  useAuthAction,
  useEmailPasswordValidation,
  useFieldValidation,
} from './fields';
import type { EmailPasswordValidation, FieldValidation } from './fields';

// Supabase local minimum (supabase/config.toml, minimum_password_length); the server re-checks.
const MIN_PASSWORD_LENGTH = 6;
const ROLES: readonly UserRole[] = ['student', 'teacher'];

interface RegisterValues {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly role: UserRole;
}

const EMPTY: RegisterValues = { displayName: '', email: '', password: '', role: 'student' };

/**
 * Own validation message for the name field; empty string when the value is fine (#523). The
 * name is required: without it the database would fall back to a neutral one, and the name is
 * what the learner's teachers read, never the email.
 */
export function displayNameValidationError(t: Translate, displayName: string): string {
  return displayName.trim() === '' ? t('auth.validation.displayNameRequired') : '';
}

interface RegisterFieldsProps {
  readonly values: RegisterValues;
  readonly onChange: (patch: Partial<RegisterValues>) => void;
}

function RoleChoice({ values, onChange }: RegisterFieldsProps): JSX.Element {
  const t = useT();
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 font-medium">{t('auth.fields.role')}</legend>
      {ROLES.map((option) => (
        <label key={option} className="flex h-[44px] items-center gap-2">
          <input
            type="radio"
            name="role"
            value={option}
            checked={values.role === option}
            onChange={() => onChange({ role: option })}
          />
          {option === 'teacher' ? t('auth.roles.teacher') : t('auth.roles.student')}
        </label>
      ))}
    </fieldset>
  );
}

interface RegisterValidation {
  readonly validation: EmailPasswordValidation;
  readonly nameValidation: FieldValidation;
}

/** The required name (#523), with its own message under the field (#534). */
function NameField({
  values,
  onChange,
  nameValidation,
}: RegisterFieldsProps & Pick<RegisterValidation, 'nameValidation'>): JSX.Element {
  const t = useT();
  return (
    <TextField
      id="display-name"
      label={t('auth.fields.displayName')}
      type="text"
      value={values.displayName}
      onChange={(displayName) => {
        onChange({ displayName });
        nameValidation.clear();
      }}
      autoComplete="name"
      error={nameValidation.error}
    />
  );
}

function RegisterFields({
  values,
  onChange,
  validation,
  nameValidation,
}: RegisterFieldsProps & RegisterValidation): JSX.Element {
  return (
    <>
      <NameField values={values} onChange={onChange} nameValidation={nameValidation} />
      <EmailPasswordFields
        email={values.email}
        password={values.password}
        onEmail={(email) => {
          onChange({ email });
          validation.clearEmailError();
        }}
        onPassword={(password) => {
          onChange({ password });
          validation.clearPasswordError();
        }}
        passwordAutoComplete="new-password"
        minPasswordLength={MIN_PASSWORD_LENGTH}
        emailError={validation.emailError}
        passwordError={validation.passwordError}
      />
      <RoleChoice values={values} onChange={onChange} />
    </>
  );
}

// Astro mounts it with client:visible. With email confirmations disabled (local stack) sign-up
// returns a session and the form goes to /cuenta; otherwise it asks the user to check the email.
// An address that already has an account gets that same answer (#520).
export function RegisterForm(): JSX.Element {
  const t = useT();
  const [values, setValues] = useState<RegisterValues>(EMPTY);
  const validation = useEmailPasswordValidation();
  const nameValidation = useFieldValidation();
  const { state, run } = useAuthAction();

  // `noValidate` on the form (#534): the browser's own bubble speaks whatever language it is set
  // to, not the Spanish of the rest of the page, so each field shows its own message instead.
  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const nameOk = nameValidation.validate(values.displayName, displayNameValidationError);
    if (!validation.validate(values.email, values.password) || !nameOk) return;
    const displayName = values.displayName.trim();
    void run(
      () => signUp({ ...values, displayName, redirectTo: absoluteUrl('/cuenta') }),
      (result) => (result.ok && result.session ? goTo('/cuenta') : t('auth.register.confirmEmail')),
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <RegisterFields
        values={values}
        onChange={(patch) => setValues({ ...values, ...patch })}
        validation={validation}
        nameValidation={nameValidation}
      />
      <FormStatus {...state} />
      <div>
        <SubmitButton pending={state.pending} label={t('auth.register.submit')} />
      </div>
      <FormFooter>
        <span>{t('auth.register.hasAccount')}</span>
        <a href="/auth/login">{t('auth.register.login')}</a>
      </FormFooter>
    </form>
  );
}
