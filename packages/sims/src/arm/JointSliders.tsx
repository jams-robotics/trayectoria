import { useMemo } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import { degToRad, radToDeg } from '@trayectoria/sim-core';
import { ParamPanel } from '@trayectoria/widgets';
import type { ParamPanelParam } from '@trayectoria/widgets';

import type { ActuatedJoint } from './types';

// F5-01a (#133, decisión 7): un slider por articulación actuada, en grados en pantalla y
// radianes internos, con los límites del spec. `ParamPanel` ya recorta al rango y encaja al paso.

/** Paso de los sliders, en grados. */
const STEP_DEG = 1;

/** Un parámetro de `ParamPanel` por articulación, con los límites del spec pasados a grados. */
export function jointParams(
  joints: readonly ActuatedJoint[],
  q_rad: readonly number[],
  unit_deg: string,
): readonly ParamPanelParam[] {
  return joints.map((joint, index) => ({
    key: joint.name,
    label: joint.name,
    unit: unit_deg,
    min: radToDeg(joint.lower_rad),
    max: radToDeg(joint.upper_rad),
    step: STEP_DEG,
    value: radToDeg(q_rad[index] ?? 0),
  }));
}

export interface JointSlidersProps {
  joints: readonly ActuatedJoint[];
  q_rad: readonly number[];
  /** Recibe el índice de la articulación y su nuevo valor en radianes. */
  onChange: (index: number, q_rad: number) => void;
}

/** Sliders de las articulaciones del brazo, uno por articulación actuada. */
export function JointSliders({ joints, q_rad, onChange }: JointSlidersProps): JSX.Element {
  const t = useT();
  const unit_deg = t('sims.arm.unitDeg');
  const params = useMemo(() => jointParams(joints, q_rad, unit_deg), [joints, q_rad, unit_deg]);
  const indexOf = useMemo(
    () => new Map(joints.map((joint) => [joint.name, joint.index])),
    [joints],
  );

  return (
    <section aria-label={t('sims.arm.joints')} data-testid="joint-sliders">
      <h3 className="text-fg-muted font-mono text-xs tracking-[0.06em] uppercase">
        {t('sims.arm.joints')}
      </h3>
      <div className="mt-3">
        <ParamPanel
          params={params}
          onChange={(key, value_deg) => {
            const index = indexOf.get(key);
            if (index !== undefined) onChange(index, degToRad(value_deg));
          }}
        />
      </div>
    </section>
  );
}
