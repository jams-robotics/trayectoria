import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import type { EffectorReadout } from './types';

// F5-01a (#133, decisión 7): posición en metros con 3 decimales y orientación en grados con 1,
// siempre de `endEffectorPose` de sim-core. Ningún número de este panel sale de three
// (docs/ARCHITECTURE.md §4.5, docs/DEFINITION-OF-DONE.md tipo sim).

/** Una fila del panel: clave de etiqueta, valor ya formateado y clave de unidad. */
interface Row {
  readonly labelKey: string;
  readonly value: string;
  readonly unitKey: string;
}

/** Las seis filas del panel, en el orden en que se muestran. */
export function effectorRows(readout: EffectorReadout): readonly Row[] {
  return [
    { labelKey: 'sims.arm.x', value: readout.x_m, unitKey: 'sims.arm.unitM' },
    { labelKey: 'sims.arm.y', value: readout.y_m, unitKey: 'sims.arm.unitM' },
    { labelKey: 'sims.arm.z', value: readout.z_m, unitKey: 'sims.arm.unitM' },
    { labelKey: 'sims.arm.roll', value: readout.roll_deg, unitKey: 'sims.arm.unitDeg' },
    { labelKey: 'sims.arm.pitch', value: readout.pitch_deg, unitKey: 'sims.arm.unitDeg' },
    { labelKey: 'sims.arm.yaw', value: readout.yaw_deg, unitKey: 'sims.arm.unitDeg' },
  ];
}

/** Resumen de una línea del panel, para el `aria-live` (docs/DESIGN.md §8). */
export function effectorSummary(readout: EffectorReadout, t: Translate): string {
  return effectorRows(readout)
    .map((row) =>
      t('sims.arm.readoutItem', {
        label: t(row.labelKey),
        value: row.value,
        unit: t(row.unitKey),
      }),
    )
    .join(' · ');
}

export interface EffectorPanelProps {
  readout: EffectorReadout;
}

/** Panel del efector: posición y orientación calculadas por sim-core. */
export function EffectorPanel({ readout }: EffectorPanelProps): JSX.Element {
  const t = useT();
  return (
    <section aria-label={t('sims.arm.effector')} data-testid="effector-panel">
      <h3 className="text-fg-muted font-mono text-xs tracking-[0.06em] uppercase">
        {t('sims.arm.effector')}
      </h3>
      <dl className="mt-3 flex flex-col gap-1">
        {effectorRows(readout).map((row) => (
          <div key={row.labelKey} className="flex items-baseline justify-between gap-3">
            <dt className="text-fg-muted font-mono text-sm">{t(row.labelKey)}</dt>
            <dd className="flex items-baseline gap-1">
              <span
                className="text-fg text-right font-mono text-sm tabular-nums"
                data-testid={row.labelKey}
              >
                {row.value}
              </span>
              <span className="text-fg-muted w-4 font-mono text-xs">{t(row.unitKey)}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="sr-only" aria-live="polite">
        {effectorSummary(readout, t)}
      </p>
    </section>
  );
}
