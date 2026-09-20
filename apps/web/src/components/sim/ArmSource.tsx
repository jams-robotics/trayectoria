import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

// F5-01b (#134, decisión 2): selector del brazo del catálogo. Los ids llegan como props
// serializables desde `brazo.astro`, que los resuelve en build con `getCollection('arms')`; esta
// isla no lee el catálogo ni importa sim-core.
//
// F5-04 (#137, decisión 3): además, el grupo «Mis robots» con las filas `kind = 'arm-serial'` del
// estudiante con sesión —sin sesión no se muestra— y la opción «Importar…», que abre el diálogo de
// importación en lugar de cambiar de brazo.

/** Brazo del catálogo tal y como lo recibe la isla: solo lo que se muestra en el selector. */
export interface ArmOption {
  readonly id: string;
  readonly name: string;
}

/** Un brazo guardado del estudiante, tal y como lo muestra el grupo «Mis robots». */
export interface SavedArmOption {
  readonly id: string;
  readonly name: string;
}

/** Id del brazo por defecto cuando la URL no trae ninguno o trae uno desconocido. */
export const DEFAULT_ARM_ID = 'planar2dof';

/** Prefijo de los valores de «Mis robots», para no chocar con un id del catálogo. */
export const SAVED_PREFIX = 'saved:';

/** Valor de la opción que abre el diálogo de importación; no es un brazo. */
export const IMPORT_VALUE = 'import';

/** Valor del selector cuando se está mostrando un brazo importado solo en memoria. */
export const IMPORTED_VALUE = 'imported';

/** El id de un brazo guardado a partir del valor del selector, o `null` si no es uno. */
export function savedIdOf(value: string): string | null {
  return value.startsWith(SAVED_PREFIX) ? value.slice(SAVED_PREFIX.length) : null;
}

/** Resuelve el id pedido contra el catálogo; devuelve el de reserva si no existe. */
export function resolveArmId(requested: string | null, arms: readonly ArmOption[]): string {
  if (requested !== null && arms.some((arm) => arm.id === requested)) return requested;
  if (arms.some((arm) => arm.id === DEFAULT_ARM_ID)) return DEFAULT_ARM_ID;
  return arms[0]?.id ?? DEFAULT_ARM_ID;
}

const SELECT =
  'border-border bg-bg-raised text-fg h-11 rounded-md border px-3 text-sm ' +
  'focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2';

/** El grupo «Mis robots»; nada sin sesión o sin brazos guardados (#137, decisión 3). */
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

/** Las opciones del selector: el catálogo, los guardados, el importado en memoria e «Importar…». */
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
  /** Id actualmente seleccionado: uno del catálogo, `saved:{id}` o `imported`. */
  selected: string;
  /** Si el id de la URL no existía y se cayó al brazo por defecto. */
  fallback: boolean;
  /** Los brazos guardados del estudiante; lista vacía sin sesión. */
  savedArms?: readonly SavedArmOption[];
  /** Nombre del brazo importado en memoria, si lo hay; entonces aparece su propia opción. */
  importedName?: string | null;
  onSelect: (id: string) => void;
  /** Se llama cuando el estudiante elige «Importar…». */
  onImport?: () => void;
}

/** Selector del brazo: catálogo, los guardados con sesión y la opción de importar. */
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
