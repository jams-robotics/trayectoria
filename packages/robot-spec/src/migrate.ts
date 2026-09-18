// Versioning of RobotSpec (docs/ROBOT-SPEC.md §5). `specVersion` is an integer; every
// incompatible change bumps CURRENT_SPEC_VERSION and registers one step in MIGRATIONS,
// indexed by the version it starts from. Stored specs are migrated when read, never in bulk.

export const CURRENT_SPEC_VERSION = 1;

type RawSpec = Record<string, unknown>;

/** Transforms a spec from version `n` to version `n + 1`; the loop sets `specVersion`. */
type Migration = (spec: RawSpec) => RawSpec;

// v1 -> v1 is the identity, so there is nothing to register yet.
const MIGRATIONS: Readonly<Record<number, Migration>> = {};

function isRecord(value: unknown): value is RawSpec {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readVersion(spec: RawSpec): number | undefined {
  const version = spec.specVersion;
  return typeof version === 'number' && Number.isInteger(version) ? version : undefined;
}

/**
 * Brings a raw spec up to CURRENT_SPEC_VERSION, one step at a time. Anything that is not a
 * migratable object (no integer `specVersion`, unknown version) is returned untouched so that
 * `parseRobotSpec` reports the error.
 */
export function migrateRobotSpec(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  let spec = raw;
  let version = readVersion(spec);
  while (version !== undefined && version < CURRENT_SPEC_VERSION) {
    const step = MIGRATIONS[version];
    if (step === undefined) return spec;
    spec = { ...step(spec), specVersion: version + 1 };
    version = readVersion(spec);
  }
  return spec;
}
