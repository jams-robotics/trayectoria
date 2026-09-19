import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';

import type { ParamPanelParam } from '../ParamPanel/ParamPanel';
import { ReadoutPanel } from '../shared/ReadoutPanel';
import type { GearStages, Train } from './compute';
import { panelRows } from './rows';

export { animationScale, directionOf, panelRows, statusOf } from './rows';

/** Which value of the train a slider edits (#91, decision 5). */
export type GearParam = 'z1' | 'z2' | 'z3' | 'z4' | 'nIn' | 'torqueIn' | 'efficiency';

/** Slider ranges of decision 5 of #91. */
const RANGES: Readonly<Record<GearParam, { min: number; max: number; step: number }>> = {
  z1: { min: 8, max: 80, step: 1 },
  z2: { min: 8, max: 80, step: 1 },
  z3: { min: 8, max: 80, step: 1 },
  z4: { min: 8, max: 80, step: 1 },
  nIn: { min: 100, max: 8000, step: 10 },
  torqueIn: { min: 0.001, max: 0.1, step: 0.001 },
  efficiency: { min: 0.1, max: 1, step: 0.01 },
};

/** The value each slider shows, taken from the train. */
const VALUES: Readonly<Record<GearParam, (train: Train) => number>> = {
  z1: (train) => train.z1,
  z2: (train) => train.z2,
  z3: (train) => train.z3,
  z4: (train) => train.z4,
  nIn: (train) => train.nIn_rpm,
  torqueIn: (train) => train.torqueIn_Nm,
  efficiency: (train) => train.efficiency,
};

/** The i18n key of the unit of each slider; the tooth counts are dimensionless. */
const UNIT_KEYS: Readonly<Record<GearParam, string>> = {
  z1: '',
  z2: '',
  z3: '',
  z4: '',
  nIn: 'widgets.GearWidget.unitRpm',
  torqueIn: 'widgets.GearWidget.unitNm',
  efficiency: '',
};

/** Sliders of a single stage; the second stage adds `z3` and `z4` (#91, decision 5). */
const FIRST_STAGE: readonly GearParam[] = ['z1', 'z2'];
const SECOND_STAGE: readonly GearParam[] = ['z3', 'z4'];
const DRIVE: readonly GearParam[] = ['nIn', 'torqueIn', 'efficiency'];

/** The sliders the learner may edit in this train (#91, decision 5). */
export function paramsOf(
  stages: GearStages,
  train: Train,
  t: Translate,
): readonly ParamPanelParam[] {
  const keys = [...FIRST_STAGE, ...(stages === 2 ? SECOND_STAGE : []), ...DRIVE];
  return keys.map((key) => ({
    key,
    label: t(`widgets.GearWidget.param${key}`),
    unit: UNIT_KEYS[key] === '' ? '' : t(UNIT_KEYS[key]),
    value: VALUES[key](train),
    ...RANGES[key],
  }));
}

/** Applies one slider change to the train (#91, decision 5). */
export function applyChange(train: Train, key: string, value: number): Train {
  if (key === 'z1') return { ...train, z1: value };
  if (key === 'z2') return { ...train, z2: value };
  if (key === 'z3') return { ...train, z3: value };
  if (key === 'z4') return { ...train, z4: value };
  if (key === 'nIn') return { ...train, nIn_rpm: value };
  if (key === 'torqueIn') return { ...train, torqueIn_Nm: value };
  if (key === 'efficiency') return { ...train, efficiency: value };
  return train;
}

/** The values panel of the train: ratios, output speed, torque, powers and direction. */
export function ResultsPanel({
  stages,
  train,
  t,
}: {
  stages: GearStages;
  train: Train;
  t: Translate;
}): JSX.Element {
  return (
    <ReadoutPanel title={t('widgets.GearWidget.panel')} rows={panelRows(stages, train, t)} />
  );
}
