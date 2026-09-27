import { signUp, type UserRole } from '@trayectoria/auth';
import { useT } from '@trayectoria/i18n';
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
} from './fields';
import type { EmailPasswordValidation } from './fields';

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

function RegisterFields({
  values,
  onChange,
  validation,
}: RegisterFieldsProps & { validation: EmailPasswordValidation }): JSX.Element {
  const t = useT();
  return (
    <>
      <TextField
        id="display-name"
        label={t('auth.fields.displayName')}
        type="text"
        value={values.displayName}
        onChange={(displayName) => onChange({ displayName })}
        autoComplete="name"
      />
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
export function RegisterForm(): JSX.Element {
  const t = useT();
  const [values, setValues] = useState<RegisterValues>(EMPTY);
  const validation = useEmailPasswordValidation();
  const { state, run } = useAuthAction();

  // `noValidate` on the form (#534): the browser's own bubble speaks whatever language it is set
  // to, not the Spanish of the rest of the page, so each field shows its own message instead.
  function submit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!validation.validate(values.email, values.password)) return;
    void run(
      () => signUp({ ...values, redirectTo: absoluteUrl('/cuenta') }),
      (result) => (result.ok && result.session ? goTo('/cuenta') : t('auth.register.confirmEmail')),
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <RegisterFields
        values={values}
        onChange={(patch) => setValues({ ...values, ...patch })}
        validation={validation}
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
