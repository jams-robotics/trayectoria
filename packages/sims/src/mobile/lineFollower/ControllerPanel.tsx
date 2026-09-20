import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { MobileSpec } from '@trayectoria/robot-spec';
import { ParamPanel } from '@trayectoria/widgets';

import { CONTROLLERS, CONTROLLER_IDS, controllerParams } from './controllers';
import type { ControllerId, ControllerParams } from './controllers';

const TAB =
  'inline-flex h-9 items-center rounded-sm border px-3 text-sm font-semibold transition-colors' +
  ' duration-[120ms]';
const TAB_ON = `${TAB} bg-primary text-primary-fg border-primary`;
const TAB_OFF = `${TAB} bg-bg-raised text-fg border-border hover:border-fg-muted`;
const TAB_DISABLED = `${TAB} bg-bg-raised text-fg-muted border-border cursor-default opacity-45`;

/** The tab of the student's own controller: v2, shown disabled (docs/DESIGN.md §6). */
function CustomTab({ t }: { t: Translate }): JSX.Element {
  return (
    <button
      type="button"
      className={TAB_DISABLED}
      disabled
      aria-disabled="true"
      data-testid="line-follower-custom"
    >
      {t('sims.lineFollower.custom')}
      <span className="ml-2 font-mono text-xs">{t('sims.lineFollower.customBadge')}</span>
    </button>
  );
}

export interface ControllerPanelProps {
  readonly controller: ControllerId;
  readonly params: ControllerParams;
  readonly spec: MobileSpec;
  readonly onController: (id: ControllerId) => void;
  readonly onParam: (key: string, value: number) => void;
}

/**
 * Controller selector and its sliders (docs/DESIGN.md §6): Manual · On/off · P · PID, plus the
 * disabled «Propio» tab that v2 will enable. Selecting a controller or moving a slider restarts
 * the run, which the widget above decides; this component only reports the change.
 */
export function ControllerPanel({
  controller,
  params,
  spec,
  onController,
  onParam,
}: ControllerPanelProps): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-col gap-3" data-testid="line-follower-controller">
      <div role="group" aria-label={t('sims.lineFollower.controllerGroup')} className="flex flex-wrap gap-2">
        {CONTROLLER_IDS.map((id) => (
          <button
            key={id}
            type="button"
            className={id === controller ? TAB_ON : TAB_OFF}
            aria-pressed={id === controller}
            onClick={() => {
              onController(id);
            }}
          >
            {t(CONTROLLERS[id].labelKey)}
          </button>
        ))}
        <CustomTab t={t} />
      </div>
      <ParamPanel params={controllerParams(controller, params, spec, t)} onChange={onParam} />
    </div>
  );
}
