import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { PanelCard } from './PanelCard';
import type { EffectorReadout } from './types';

// F5-01a (#133, decision 7): position in metres with 3 decimals and orientation in degrees with 1,
// always from sim-core `endEffectorPose`. No number in this panel comes from three
// (docs/ARCHITECTURE.md §4.5, docs/DEFINITION-OF-DONE.md sim type).

/** One row of the panel: label key, already formatted value and unit key. */
interface Row {
  readonly labelKey: string;
  readonly value: string;
  readonly unitKey: string;
}

/** The six rows of the panel, in display order. */
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

/** One-line summary of the panel, for the `aria-live` (docs/DESIGN.md §8). */
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

/** Effector panel: position and orientation computed by sim-core. */
export function EffectorPanel({ readout }: EffectorPanelProps): JSX.Element {
  const t = useT();
  return (
    <section aria-label={t('sims.arm.effector')} data-testid="effector-panel">
      <PanelCard title={t('sims.arm.effector')} testId="effector-card" gapClass="gap-1">
        <dl className="flex flex-col gap-1">
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
      </PanelCard>
      <p className="sr-only" aria-live="polite">
        {effectorSummary(readout, t)}
      </p>
    </section>
  );
}
