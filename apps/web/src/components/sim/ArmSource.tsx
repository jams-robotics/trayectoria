import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

// F5-01b (#134, decision 2): catalogue arm selector. The ids arrive as serializable props
// from `brazo.astro`, which resolves them at build time with `getCollection('arms')`; this
// island neither reads the catalogue nor imports sim-core.
//
// F5-04 (#137, decision 3): also, the «Mis robots» group with the `kind = 'arm-serial'` rows of
// the signed-in learner (not shown without a session) and the «Importar…» option, which opens
// the import dialog instead of switching arms.

/** Catalogue arm as the island receives it: only what the selector shows. */
export interface ArmOption {
  readonly id: string;
  readonly name: string;
}

/** A saved arm of the learner, as the «Mis robots» group shows it. */
export interface SavedArmOption {
  readonly id: string;
  readonly name: string;
}

/** Id of the default arm when the URL carries none or carries an unknown one. */
export const DEFAULT_ARM_ID = 'planar2dof';

/** Prefix of the «Mis robots» values, so they do not clash with a catalogue id. */
export const SAVED_PREFIX = 'saved:';

/** Value of the option that opens the import dialog; it is not an arm. */
export const IMPORT_VALUE = 'import';

/** Selector value while an arm imported only in memory is being shown. */
export const IMPORTED_VALUE = 'imported';

/** The id of a saved arm from the selector value, or `null` if it is not one. */
export function savedIdOf(value: string): string | null {
  return value.startsWith(SAVED_PREFIX) ? value.slice(SAVED_PREFIX.length) : null;
}

/** Resolves the requested id against the catalogue; returns the fallback one if it is missing. */
export function resolveArmId(requested: string | null, arms: readonly ArmOption[]): string {
  if (requested !== null && arms.some((arm) => arm.id === requested)) return requested;
  if (arms.some((arm) => arm.id === DEFAULT_ARM_ID)) return DEFAULT_ARM_ID;
  return arms[0]?.id ?? DEFAULT_ARM_ID;
}

const SELECT =
  'border-border bg-bg-raised text-fg h-11 rounded-md border px-3 text-sm ' +
  'focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';

/** The «Mis robots» group; nothing without a session or without saved arms (#137, decision 3). */
function SavedGroup({
  robots,
  t,
}: {
  robots: readonly SavedArmOption[];
  t: Translate;
}): JSX.Element | null {
  if (robots.length === 0) return null;
  return (
    <optgroup label={t('sims.import.group')} data-testid="arm-saved-group">
      {robots.map((robot) => (
        <option key={robot.id} value={`${SAVED_PREFIX}${robot.id}`}>
          {robot.name}
        </option>
      ))}
    </optgroup>
  );
}

/** The selector options: the catalogue, the saved ones, the in-memory imported one and «Importar…». */
function ArmOptions({
  arms,
  savedArms,
  importedName,
  t,
}: {
  arms: readonly ArmOption[];
  savedArms: readonly SavedArmOption[];
  importedName: string | null;
  t: Translate;
}): JSX.Element {
  return (
    <>
      <optgroup label={t('sims.import.catalogGroup')}>
        {arms.map((arm) => (
          <option key={arm.id} value={arm.id}>
            {arm.name}
          </option>
        ))}
      </optgroup>
      <SavedGroup robots={savedArms} t={t} />
      {importedName === null ? null : (
        <option value={IMPORTED_VALUE} data-testid="arm-imported-option">
          {importedName}
        </option>
      )}
      <option value={IMPORT_VALUE}>{t('sims.import.importOption')}</option>
    </>
  );
}

export interface ArmSourceProps {
  arms: readonly ArmOption[];
  /** Currently selected id: one from the catalogue, `saved:{id}` or `imported`. */
  selected: string;
  /** Whether the URL id did not exist and it fell back to the default arm. */
  fallback: boolean;
  /** The learner's saved arms; empty list without a session. */
  savedArms?: readonly SavedArmOption[];
  /** Name of the in-memory imported arm, if any; then its own option appears. */
  importedName?: string | null;
  onSelect: (id: string) => void;
  /** Called when the learner picks «Importar…». */
  onImport?: () => void;
}

/** Arm selector: catalogue, the saved ones with a session and the import option. */
export function ArmSource({
  arms,
  selected,
  fallback,
  savedArms = [],
  importedName = null,
  onSelect,
  onImport,
}: ArmSourceProps): JSX.Element {
  const t = useT();
  const selectedName = arms.find((arm) => arm.id === selected)?.name ?? selected;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-fg-muted text-sm" htmlFor="arm-source">
        {t('sims.armPage.source')}
      </label>
      <select
        id="arm-source"
        className={SELECT}
        aria-label={t('sims.armPage.sourceHelp')}
        data-testid="arm-source-select"
        value={selected}
        onChange={(event) => {
          const value = event.target.value;
          if (value === IMPORT_VALUE) onImport?.();
          else onSelect(value);
        }}
      >
        <ArmOptions arms={arms} savedArms={savedArms} importedName={importedName} t={t} />
      </select>
      {fallback ? (
        <p className="text-fg-muted text-sm" role="status" data-testid="arm-source-fallback">
          {t('sims.armPage.fallback', { name: selectedName })}
        </p>
      ) : null}
    </div>
  );
}
