import { useMemo } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import { degToRad, radToDeg } from '@trayectoria/sim-core';
import { ParamPanel } from '@trayectoria/widgets';
import type { ParamPanelParam } from '@trayectoria/widgets';

import { labelOf } from './ficha';
import { PanelTitle } from './PanelCard';
import type { ActuatedJoint } from './types';

// F5-01a (#133, decision 7): one slider per actuated joint, in degrees on screen and
// radians internally, with the spec limits. `ParamPanel` already clamps to the range and snaps to the step.

/** Step of the sliders, in degrees. */
const STEP_DEG = 1;

/**
 * Rounds a joint limit to whole degrees (#550: "-94.99984" from the raw URDF conversion), always
 * inward, so the slider never asks the joint for an angle its real limit does not allow.
 */
function roundLimitInward_deg(value_deg: number, direction: 'lower' | 'upper'): number {
  return direction === 'lower' ? Math.ceil(value_deg) : Math.floor(value_deg);
}

/** Labels of an arm without a catalog card: every slider is named after its URDF joint. */
const NO_JOINT_LABELS: ReadonlyMap<string, string> = new Map();

/**
 * One `ParamPanel` parameter per joint, with the spec limits converted to degrees. The label is
 * the readable name of the card when it has one, with the URDF id as auxiliary text (#535).
 */
export function jointParams(
  joints: readonly ActuatedJoint[],
  q_rad: readonly number[],
  unit_deg: string,
  labels: ReadonlyMap<string, string> = NO_JOINT_LABELS,
): readonly ParamPanelParam[] {
  return joints.map((joint, index) => ({
    key: joint.name,
    label: labelOf(labels, joint.name),
    ...(labels.has(joint.name) ? { description: joint.name } : {}),
    unit: unit_deg,
    min: roundLimitInward_deg(radToDeg(joint.lower_rad), 'lower'),
    max: roundLimitInward_deg(radToDeg(joint.upper_rad), 'upper'),
    step: STEP_DEG,
    value: radToDeg(q_rad[index] ?? 0),
  }));
}

export interface JointSlidersProps {
  joints: readonly ActuatedJoint[];
  q_rad: readonly number[];
  /** Receives the joint index and its new value in radians. */
  onChange: (index: number, q_rad: number) => void;
  /** Readable name of each joint, by URDF name (#535); without it, the URDF names. */
  labels?: ReadonlyMap<string, string> | undefined;
}

/** Sliders for the arm joints, one per actuated joint. */
export function JointSliders({ joints, q_rad, onChange, labels }: JointSlidersProps): JSX.Element {
  const t = useT();
  const unit_deg = t('sims.arm.unitDeg');
  const params = useMemo(
    () => jointParams(joints, q_rad, unit_deg, labels),
    [joints, q_rad, unit_deg, labels],
  );
  const indexOf = useMemo(
    () => new Map(joints.map((joint) => [joint.name, joint.index])),
    [joints],
  );

  return (
    <section aria-label={t('sims.arm.joints')} data-testid="joint-sliders">
      <PanelTitle>{t('sims.arm.joints')}</PanelTitle>
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
