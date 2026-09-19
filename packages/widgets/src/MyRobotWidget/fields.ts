/**
 * The editable fields of «Mi robot»: every number of `MobileSpec` (docs/ROBOT-SPEC.md §1.1),
 * grouped as the form shows them (#95, decision 4). The path is the dotted path inside the
 * spec, which is also the `path` `parseRobotSpec` reports its errors on.
 */
import { rpmToRadps } from '@trayectoria/sim-core';
import type { MobileSpec, RobotSpec } from '@trayectoria/robot-spec';

/** A numeric field of the form: its path in the spec, its i18n label key and its unit. */
export interface RobotField {
  /** Path inside `mobile`, e.g. `wheelRadius_m` or `lineSensors.count`. */
  key: string;
  /** Unit shown after the field; empty for the dimensionless ones. */
  unit: string;
  /** `true` for the fields of an optional block, which may be left empty. */
  optional?: boolean;
  /** `true` for the fields the schema declares as integers. */
  integer?: boolean;
}

export interface RobotFieldGroup {
  id: 'chassis' | 'drive' | 'sensors' | 'optional';
  fields: readonly RobotField[];
}

/** The four groups of the form, in the order docs/WIDGETS.md and #95 decision 4 fix. */
export const FIELD_GROUPS: readonly RobotFieldGroup[] = [
  {
    id: 'chassis',
    fields: [
      { key: 'length_m', unit: 'm' },
      { key: 'width_m', unit: 'm' },
      { key: 'mass_kg', unit: 'kg' },
    ],
  },
  {
    id: 'drive',
    fields: [
      { key: 'wheelRadius_m', unit: 'm' },
      { key: 'wheelBase_m', unit: 'm' },
      { key: 'maxMotorSpeed_rpm', unit: 'rpm' },
      { key: 'gearRatio', unit: '' },
      { key: 'maxAccel_radps2', unit: 'rad/s²', optional: true },
      { key: 'encoderTicksPerRev', unit: '', optional: true, integer: true },
    ],
  },
  {
    id: 'sensors',
    fields: [
      { key: 'lineSensors.count', unit: '', integer: true },
      { key: 'lineSensors.spacing_m', unit: 'm' },
      { key: 'lineSensors.forwardOffset_m', unit: 'm' },
      { key: 'lineSensors.footprint_m', unit: 'm' },
    ],
  },
  {
    id: 'optional',
    fields: [
      { key: 'motor.stallTorque_Nm', unit: 'N·m', optional: true },
      { key: 'motor.nominalVoltage_V', unit: 'V', optional: true },
      { key: 'motor.efficiency', unit: '', optional: true },
      { key: 'battery.capacity_Wh', unit: 'Wh', optional: true },
    ],
  },
];

export const ALL_FIELDS: readonly RobotField[] = FIELD_GROUPS.flatMap((group) => group.fields);

/** Every draft of the form, keyed by field path; values are the raw text the learner typed. */
export type RobotDraft = Readonly<Record<string, string>>;

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (typeof value !== 'object' || value === null) return undefined;
    return Object.getOwnPropertyDescriptor(value, segment)?.value;
  }, source);
}

/** Formats a number without floating-point noise; an absent optional field is empty text. */
function formatValue(value: unknown): string {
  if (typeof value !== 'number') return '';
  return String(Number(value.toFixed(6)));
}

/** The text of every field of the form for `spec`. */
export function draftOf(spec: RobotSpec): RobotDraft {
  const mobile = spec.mobile;
  return Object.fromEntries(
    ALL_FIELDS.map((field) => [field.key, formatValue(readPath(mobile, field.key))]),
  );
}

function childOf(node: Record<string, unknown>, segment: string): Record<string, unknown> {
  const child: Record<string, unknown> = {};
  const next = node[segment];
  if (typeof next === 'object' && next !== null) Object.assign(child, next);
  node[segment] = child;
  return child;
}

function writePath(target: Record<string, unknown>, path: string, value: number): void {
  const segments = path.split('.');
  const last = segments.at(-1) ?? path;
  const parent = segments.slice(0, -1).reduce(childOf, target);
  parent[last] = value;
}

/** The number a draft cell holds, or `undefined` when it is empty or not a number. */
export function parseCell(raw: string): number | undefined {
  const text = raw.replace(',', '.').trim();
  if (text === '') return undefined;
  const value = Number(text);
  return Number.isNaN(value) ? undefined : value;
}

/**
 * Rebuilds a candidate spec from the form: `name` plus every non-empty field. Empty cells of an
 * optional block drop the field, so `parseRobotSpec` sees the shape it expects; empty cells of
 * a required one stay absent and the parse reports them as missing.
 */
export function specFromDraft(base: RobotSpec, name: string, draft: RobotDraft): unknown {
  const mobile: Record<string, unknown> = {};
  for (const field of ALL_FIELDS) {
    const value = parseCell(draft[field.key] ?? '');
    if (value === undefined) continue;
    writePath(mobile, field.key, value);
  }
  return { ...base, name, mobile };
}

/** `ω_max = rpmToRadps(maxMotorSpeed_rpm) / gearRatio` (docs/ROBOT-SPEC.md §1.1). */
export function omegaMax_radps(spec: MobileSpec): number {
  return rpmToRadps(spec.maxMotorSpeed_rpm) / spec.gearRatio;
}

/** `v_max = ω_max · r` (docs/ROBOT-SPEC.md §3). */
export function vMax_mps(spec: MobileSpec): number {
  return omegaMax_radps(spec) * spec.wheelRadius_m;
}
