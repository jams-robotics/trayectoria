import { useState } from 'react';
import type { JSX, ReactNode } from 'react';
import { useT } from '@trayectoria/i18n';
import type { MobileSpec, RobotSpec } from '@trayectoria/robot-spec';
import { ParamPanel } from '@trayectoria/widgets';

import { CONTROLLERS, CONTROLLER_IDS, controllerParams, isControllerId } from './controllers';
import type { ControllerId, ControllerParams } from './controllers';

const TAB =
  'inline-flex h-9 items-center rounded-sm border px-3 text-sm font-semibold transition-colors' +
  ' duration-[120ms]';
const TAB_ON = `${TAB} bg-primary text-primary-fg border-primary`;
const TAB_OFF = `${TAB} bg-bg-raised text-fg border-border hover:border-fg-muted`;

export interface ControllerPanelProps {
  readonly controller: ControllerId;
  readonly params: ControllerParams;
  readonly spec: MobileSpec;
  readonly onController: (id: ControllerId) => void;
  readonly onParam: (key: string, value: number) => void;
  /** Puts the gains back to the values the widget opened with. */
  readonly onReset?: () => void;
}

/**
 * Controller selector and its sliders (docs/DESIGN.md §6): Manual · On/off · P · PID, plus the
 * reset button. Moving a slider applies to the run in progress and
 * picking another controller restarts it (#161), which the widget above decides; this component
 * only reports the change.
 */
export function ControllerPanel({
  controller,
  params,
  spec,
  onController,
  onParam,
  onReset,
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
      </div>
      {controller === 'manual' ? (
        <p className="text-fg-muted text-sm" data-testid="manual-instructions">
          {t('sims.manual.instructions')}
        </p>
      ) : null}
      <ParamPanel params={controllerParams(controller, params, spec, t)} onChange={onParam} />
      {onReset === undefined ? null : (
        <button type="button" className={`${TAB_OFF} self-start`} onClick={onReset}>
          {t('sims.lineFollower.reset')}
        </button>
      )}
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
  onReset: () => void;
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
    onReset: () => {
      setParams({
        ...CONTROLLERS[selected].defaults,
        ...(selected === controller ? initialParams : {}),
      });
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
  onReset,
  renderPanel,
}: {
  spec: RobotSpec;
  controller: ControllerId;
  params: ControllerParams;
  onController: (id: ControllerId) => void;
  onParam: (key: string, value: number) => void;
  onReset: () => void;
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
      onReset={onReset}
    />
  );
  // With `renderPanel` the page decides where the panel goes and how wide it is (F4-02b: mockup
  // 04 puts it in its own column, not next to the viewer), so the widget adds no column of
  // its own; without it the panel keeps the side column of F4-02a.
  if (renderPanel !== undefined) return <>{renderPanel(content)}</>;
  return <div className="flex flex-col gap-4 lg:w-panel">{content}</div>;
}
