/** Form state of `MyRobotWidget` (#95, decision 4): drafts, per-field errors and saving. */
import { useEffect, useState } from 'react';
import { parseRobotSpec } from '@trayectoria/robot-spec';
import type { RobotSpec, ValidationError } from '@trayectoria/robot-spec';

import { resetMyRobot, setMyRobot } from '../stores/myRobot';
import { draftOf, specFromDraft } from './fields';
import type { RobotDraft } from './fields';
import { useMyRobot } from './useMyRobot';

/** Error messages by field path, as `parseRobotSpec` reports them (prefix `mobile.` dropped). */
export type FieldErrors = Readonly<Record<string, string>>;

/** What the toast says after the last action, or `null` when there is nothing to announce. */
export interface FormNotice {
  readonly message: string;
  readonly tone: 'success' | 'error';
}

export interface MyRobotFormState {
  readonly robot: RobotSpec;
  readonly name: string;
  readonly draft: RobotDraft;
  readonly errors: FieldErrors;
  readonly notice: FormNotice | null;
  setName: (name: string) => void;
  editField: (key: string, raw: string) => void;
  /** Validates one field in isolation, on blur. */
  blurField: (key: string) => void;
  save: () => void;
  reset: () => void;
  dismiss: () => void;
}

/** Messages by field, keyed the way the form addresses its inputs (without the `mobile.` root). */
function errorsOf(errors: readonly ValidationError[]): FieldErrors {
  const messages: Record<string, string> = {};
  for (const { path, message } of errors) messages[path.replace(/^mobile\./, '')] = message;
  return messages;
}

/** Errors of the candidate spec built from the current drafts. */
function validate(base: RobotSpec, name: string, draft: RobotDraft): FieldErrors {
  const parsed = parseRobotSpec(specFromDraft(base, name, draft));
  return parsed.ok ? {} : errorsOf(parsed.errors);
}

/** `errors` with `key` set to `message`, or without it when the field is now valid. */
function withFieldError(errors: FieldErrors, key: string, message: string | undefined): FieldErrors {
  const next = { ...errors };
  if (message === undefined) delete next[key];
  else next[key] = message;
  return next;
}

/** The draft state the form owns: the name and every field, plus the setters for both. */
interface Drafts {
  readonly name: string;
  readonly draft: RobotDraft;
  setName: (name: string) => void;
  setDraft: (draft: RobotDraft) => void;
}

/** Name and fields of the form, re-seeded whenever the stored robot changes (decision 2). */
function useDrafts(robot: RobotSpec, clearErrors: () => void): Drafts {
  const [name, setName] = useState(robot.name);
  const [draft, setDraft] = useState<RobotDraft>(() => draftOf(robot));
  // The remote adapter may replace the robot after the island mounts (#95, decision 2); the
  // form then shows the robot that is actually stored.
  useEffect(() => {
    setName(robot.name);
    setDraft(draftOf(robot));
    clearErrors();
    // `clearErrors` is a fresh closure on every render, so re-seeding follows `robot` alone.
  }, [robot]);
  return { name, draft, setName, setDraft };
}

interface Texts {
  readonly saved: string;
  readonly resetDone: string;
  readonly invalid: string;
}

/**
 * Drives the form: drafts follow the stored robot until the learner edits them, each field is
 * validated on blur and the whole spec on save (#95, decision 4). Nothing is written unless
 * `parseRobotSpec` accepts the candidate.
 */
export function useMyRobotForm(texts: Texts): MyRobotFormState {
  const robot = useMyRobot();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<FormNotice | null>(null);
  const { name, draft, setName, setDraft } = useDrafts(robot, () => {
    setErrors({});
  });

  const save = (): void => {
    const result = setMyRobot(specFromDraft(robot, name, draft));
    setErrors(result.ok ? {} : errorsOf(result.errors));
    const message = result.ok ? texts.saved : texts.invalid;
    setNotice({ message, tone: result.ok ? 'success' : 'error' });
  };

  const reset = (): void => {
    const spec = resetMyRobot();
    setName(spec.name);
    setDraft(draftOf(spec));
    setErrors({});
    setNotice({ message: texts.resetDone, tone: 'success' });
  };

  return {
    robot,
    name,
    draft,
    errors,
    notice,
    setName,
    save,
    reset,
    editField: (key, raw) => {
      setDraft({ ...draft, [key]: raw });
    },
    blurField: (key) => {
      setErrors(withFieldError(errors, key, validate(robot, name, draft)[key]));
    },
    dismiss: () => {
      setNotice(null);
    },
  };
}
