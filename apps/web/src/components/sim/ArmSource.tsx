import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

// F5-01b (#134, decisión 2): selector del brazo del catálogo. Los ids llegan como props
// serializables desde `brazo.astro`, que los resuelve en build con `getCollection('arms')`; esta
// isla no lee el catálogo ni importa sim-core.

/** Brazo del catálogo tal y como lo recibe la isla: solo lo que se muestra en el selector. */
export interface ArmOption {
  readonly id: string;
  readonly name: string;
}

/** Id del brazo por defecto cuando la URL no trae ninguno o trae uno desconocido. */
export const DEFAULT_ARM_ID = 'planar2dof';

/** Resuelve el id pedido contra el catálogo; devuelve el de reserva si no existe. */
export function resolveArmId(requested: string | null, arms: readonly ArmOption[]): string {
  if (requested !== null && arms.some((arm) => arm.id === requested)) return requested;
  if (arms.some((arm) => arm.id === DEFAULT_ARM_ID)) return DEFAULT_ARM_ID;
  return arms[0]?.id ?? DEFAULT_ARM_ID;
}

export interface ArmSourceProps {
  arms: readonly ArmOption[];
  /** Id actualmente seleccionado; siempre uno de `arms`. */
  selected: string;
  /** Si el id de la URL no existía y se cayó al brazo por defecto. */
  fallback: boolean;
  onSelect: (id: string) => void;
}

/** Selector del brazo del catálogo, con aviso cuando el id de la URL no existe. */
export function ArmSource({ arms, selected, fallback, onSelect }: ArmSourceProps): JSX.Element {
  const t = useT();
  const selectedName = arms.find((arm) => arm.id === selected)?.name ?? selected;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-fg-muted text-sm" htmlFor="arm-source">
        {t('sims.armPage.source')}
      </label>
      <select
        id="arm-source"
        className="border-border bg-bg-raised text-fg h-11 rounded-md border px-3 text-sm focus-visible:outline-color-focus focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={t('sims.armPage.sourceHelp')}
        data-testid="arm-source-select"
        value={selected}
        onChange={(event) => {
          onSelect(event.target.value);
        }}
      >
        {arms.map((arm) => (
          <option key={arm.id} value={arm.id}>
            {arm.name}
          </option>
        ))}
      </select>
      {fallback ? (
        <p className="text-fg-muted text-sm" role="status" data-testid="arm-source-fallback">
          {t('sims.armPage.fallback', { name: selectedName })}
        </p>
      ) : null}
    </div>
  );
}
