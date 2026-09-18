import type { z } from 'zod';

import { migrateRobotSpec } from './migrate';
import { RobotSpec } from './schema';

export { planar2dof } from './examples/planar2dof';
export { referenceMobile } from './examples/referenceMobile';
export { CURRENT_SPEC_VERSION, migrateRobotSpec } from './migrate';
export { ArmSpec, MobileSpec, RobotSpec, SimConfig, robotSpecJsonSchema } from './schema';
export type { RobotSpecInput } from './schema';

/** One validation problem: `key` is the i18n key (prefix `robotSpec.`), `message` its Spanish text. */
export interface ValidationError {
  /** Dotted path with array indices, e.g. `mobile.lineSensors.count`, `arm.joints[1].limits`. */
  path: string;
  key: string;
  message: string;
}

export interface ParseOk {
  ok: true;
  value: RobotSpec;
}

export interface ParseFailure {
  ok: false;
  errors: ValidationError[];
}

export type Result = ParseOk | ParseFailure;

type Issue = z.core.$ZodIssue;

const TYPE_NAMES_ES: Readonly<Record<string, string>> = {
  string: 'una cadena de texto',
  number: 'un número',
  boolean: 'un booleano',
  object: 'un objeto',
  array: 'una lista',
};

function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${String(segment)}]`;
    return acc === '' ? String(segment) : `${acc}.${String(segment)}`;
  }, '');
}

function sizeMessage(issue: Extract<Issue, { code: 'too_small' | 'too_big' }>): string {
  const bound = String(issue.code === 'too_small' ? issue.minimum : issue.maximum);
  if (issue.origin === 'string' || issue.origin === 'array') {
    const unit = issue.origin === 'string' ? 'caracteres' : 'elementos';
    const limit = issue.code === 'too_small' ? 'al menos' : 'como máximo';
    return `Debe tener ${limit} ${bound} ${unit}`;
  }
  const inclusive = issue.inclusive === true;
  const comparison =
    issue.code === 'too_small'
      ? inclusive
        ? 'mayor o igual que'
        : 'mayor que'
      : inclusive
        ? 'menor o igual que'
        : 'menor que';
  return `Debe ser ${comparison} ${bound}`;
}

function formatMessage(format: string): string {
  if (format === 'uuid') return 'Debe ser un UUID válido';
  if (format === 'datetime') return 'Debe ser una fecha y hora ISO 8601 válida';
  return `Formato inválido (${format})`;
}

const REQUIRED: Omit<ValidationError, 'path'> = {
  key: 'robotSpec.required',
  message: 'Campo obligatorio',
};

function typeError(issue: Extract<Issue, { code: 'invalid_type' }>): Omit<ValidationError, 'path'> {
  if (issue.input === undefined) return REQUIRED;
  if (issue.expected === 'int') {
    return { key: 'robotSpec.notInteger', message: 'Debe ser un número entero' };
  }
  const expected = TYPE_NAMES_ES[issue.expected] ?? issue.expected;
  return { key: 'robotSpec.invalidType', message: `Tipo inválido: se esperaba ${expected}` };
}

function customError(issue: Extract<Issue, { code: 'custom' }>): Omit<ValidationError, 'path'> {
  const key: unknown = issue.params?.key;
  return { key: typeof key === 'string' ? key : 'robotSpec.invalid', message: issue.message };
}

// Maps a zod issue to the platform's error shape. Needs `reportInput` to tell a missing field
// (input undefined) from a wrongly typed one.
function toValidationError(issue: Issue): ValidationError {
  const path = formatPath(issue.path);
  switch (issue.code) {
    case 'invalid_type':
      return { path, ...typeError(issue) };
    case 'too_small':
      return { path, key: 'robotSpec.tooSmall', message: sizeMessage(issue) };
    case 'too_big':
      return { path, key: 'robotSpec.tooBig', message: sizeMessage(issue) };
    case 'invalid_format':
      return { path, key: 'robotSpec.invalidFormat', message: formatMessage(issue.format) };
    case 'invalid_value': {
      // A missing literal field (e.g. specVersion) is reported as invalid_value, not invalid_type.
      if (issue.input === undefined) return { path, ...REQUIRED };
      const values = issue.values.map(String).join(', ');
      const message = `Valor no permitido; se esperaba uno de: ${values}`;
      return { path, key: 'robotSpec.invalidValue', message };
    }
    case 'invalid_union': {
      const message = 'El valor no coincide con ninguna de las variantes permitidas';
      return { path, key: 'robotSpec.invalidUnion', message };
    }
    case 'custom':
      return { path, ...customError(issue) };
    default:
      return { path, key: 'robotSpec.invalid', message: 'Valor inválido' };
  }
}

/** Migrates `input` to the current version and validates it against the RobotSpec schema. */
export function parseRobotSpec(input: unknown): Result {
  const result = RobotSpec.safeParse(migrateRobotSpec(input), { reportInput: true });
  if (result.success) return { ok: true, value: result.data };
  return { ok: false, errors: result.error.issues.map(toValidationError) };
}
