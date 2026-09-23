import { useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';
import type { MobileSpec, RobotSpec } from '@trayectoria/robot-spec';
import { ParamPanel } from '@trayectoria/widgets';

import { CONTROLLERS, CONTROLLER_IDS, controllerParams, isControllerId } from './controllers';
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
 * disabled «Propio» tab that v2 will enable. Moving a slider applies to the run in progress and
 * picking another controller restarts it (#161), which the widget above decides; this component
 * only reports the change.
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

/**
 * Which controller drives the run and with which gains; a new tab resets them to its defaults.
 * A gain alone changes only `params`, which `useLineFollower` hands to the running controller.
 */
export function useControllerChoice(
  controller: ControllerId,
  initialParams: ControllerParams,
): {
  selected: ControllerId;
  params: ControllerParams;
  onController: (id: ControllerId) => void;
  onParam: (key: string, value: number) => void;
} {
  const [selected, setSelected] = useState<ControllerId>(() =>
    isControllerId(controller) ? controller : 'pid',
  );
  const [params, setParams] = useState<ControllerParams>(() => ({
    ...CONTROLLERS[controller].defaults,
    ...initialParams,
  }));
  return {
    selected,
    params,
    onController: (id) => {
      setSelected(id);
      setParams({ ...CONTROLLERS[id].defaults });
    },
    onParam: (key, value) => {
      setParams((current) => ({ ...current, [key]: value }));
    },
  };
}

/**
 * The controller selector and its sliders. Without `renderPanel` it is the side column of
 * F4-02a; with it, the wrapper the page supplies decides the placement.
 */
export function Panel({
  spec,
  controller,
  params,
  onController,
  onParam,
  renderPanel,
}: {
  spec: RobotSpec;
  controller: ControllerId;
  params: ControllerParams;
  onController: (id: ControllerId) => void;
  onParam: (key: string, value: number) => void;
  renderPanel: ((panel: ReactNode) => ReactNode) | undefined;
}): JSX.Element | null {
  const { mobile } = spec;
  if (mobile === undefined) return null;
  const content = (
    <ControllerPanel
      controller={controller}
      params={params}
      spec={mobile}
      onController={onController}
      onParam={onParam}
    />
  );
  // With `renderPanel` the page decides where the panel goes and how wide it is (F4-02b: la
  // maqueta 04 lo pone en su propia columna, no junto al visor), so the widget adds no column of
  // its own; without it the panel keeps the side column of F4-02a.
  if (renderPanel !== undefined) return <>{renderPanel(content)}</>;
  return <div className="flex flex-col gap-4 lg:w-panel">{content}</div>;
}
