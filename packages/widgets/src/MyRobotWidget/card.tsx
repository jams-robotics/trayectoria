import type { JSX } from 'react';
import type { Translate } from '@trayectoria/i18n';
import type { RobotSpec } from '@trayectoria/robot-spec';

import { format } from '../ParamPanel/ParamPanel';
import { omegaMax_radps } from './fields';
import { labelKey } from './rows';

/** One read-only figure of the card. */
interface CardItem {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly unit: string;
}

/**
 * The four figures of the card (#95, decision 5): the two wheel dimensions, the derived
 * `ω_max` and the mass. Empty when the spec is not a mobile one, which the card never shows.
 */
export function cardItems(robot: RobotSpec, t: Translate): readonly CardItem[] {
  const mobile = robot.mobile;
  if (mobile === undefined) return [];
  return [
    {
      key: 'wheelRadius_m',
      label: t(labelKey('wheelRadius_m')),
      value: mobile.wheelRadius_m,
      unit: t('widgets.MyRobotWidget.unitM'),
    },
    {
      key: 'wheelBase_m',
      label: t(labelKey('wheelBase_m')),
      value: mobile.wheelBase_m,
      unit: t('widgets.MyRobotWidget.unitM'),
    },
    {
      key: 'omegaMax',
      label: t('widgets.MyRobotWidget.omegaMax'),
      value: Number(omegaMax_radps(mobile).toFixed(3)),
      unit: t('widgets.MyRobotWidget.unitRadps'),
    },
    {
      key: 'mass_kg',
      label: t(labelKey('mass_kg')),
      value: mobile.mass_kg,
      unit: t('widgets.MyRobotWidget.unitKg'),
    },
  ];
}

/** Read-only summary of «Mi robot», with a link to the form (#95, decision 5). */
export function RobotCard({
  robot,
  editHref,
  t,
}: {
  robot: RobotSpec;
  editHref: string;
  t: Translate;
}): JSX.Element {
  return (
    <section
      className="bg-bg-raised border-border rounded-lg border p-6"
      data-testid="my-robot-card"
      aria-label={t('widgets.MyRobotWidget.title')}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold">
          {t('widgets.MyRobotWidget.title')} · <span data-testid="my-robot-name">{robot.name}</span>
        </h3>
        <a href={editHref} className="text-primary text-sm font-semibold">
          {t('widgets.MyRobotWidget.edit')}
        </a>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cardItems(robot, t).map((item) => (
          <div key={item.key} data-card-item={item.key}>
            <dt className="text-fg-muted text-xs">{item.label}</dt>
            <dd className="font-mono text-sm tabular-nums">
              {format(item.value)} {item.unit}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
