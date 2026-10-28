import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { MobileSpec } from '@trayectoria/robot-spec';
import type { ParamPanelParam } from '@trayectoria/widgets';

import { CONTROLLER_IDS, controllerParams } from '../lineFollower/controllers';
import type { ArenaSettingsApi } from './useArenaSettings';
import type { ManualDriveApi } from './useManualDrive';

export const SEGMENT = 'flex rounded-md border border-border bg-bg p-1 gap-1';

export function segmentButton(active: boolean): string {
  return `min-h-10 flex-1 rounded-sm px-2 text-sm font-semibold transition-colors ${
    active ? 'bg-primary text-primary-fg' : 'text-fg-muted hover:bg-bg-raised hover:text-fg'
  }`;
}

/** One gain: its name, its value, the slider and what it does in one line. */
function Slider({
  param,
  onChange,
}: {
  param: ParamPanelParam;
  onChange: (key: string, value: number) => void;
}): JSX.Element {
  const t = useT();
  const id = `arena-param-${param.key}`;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-fg">
          {param.label}
        </label>
        <span className="font-mono text-sm text-fg">{`${param.value} ${param.unit}`.trim()}</span>
      </div>
      <input
        id={id}
        type="range"
        min={param.min}
        max={param.max}
        step={param.step}
        value={param.value}
        onChange={(event) => onChange(param.key, Number(event.target.value))}
        className="w-full accent-primary"
      />
      <p className="text-xs text-fg-muted">{t(`sims.arena.paramHint.${param.key}`)}</p>
    </div>
  );
}

/** Straight-line speed of a base wheel speed, so the slider reads in m/s as well. */
function speedOf(spec: MobileSpec, omega_radps: number): string {
  return (omega_radps * spec.wheelRadius_m).toFixed(2);
}

const PAD =
  'min-h-11 rounded-md border border-border bg-bg text-lg font-semibold text-fg hover:border-primary';

/** Steers while the button is held, and straightens when it is let go. */
function holdHandlers(drive: ManualDriveApi, steer: -1 | 1) {
  return {
    onPointerDown: () => drive.setSteer(steer),
    onPointerUp: () => drive.setSteer(0),
    onPointerLeave: () => drive.setSteer(0),
  };
}

function ManualPad({ drive }: { drive: ManualDriveApi }): JSX.Element {
  const t = useT();
  const hold = (steer: -1 | 1) => holdHandlers(drive, steer);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2">
        <button type="button" className={PAD} aria-label={t('sims.arena.manual.left')} {...hold(1)}>
          ←
        </button>
        <button
          type="button"
          className={PAD}
          aria-label={t('sims.arena.manual.slower')}
          onClick={() => drive.accelerate(-1)}
        >
          −
        </button>
        <button
          type="button"
          className={PAD}
          aria-label={t('sims.arena.manual.faster')}
          onClick={() => drive.accelerate(1)}
        >
          +
        </button>
        <button
          type="button"
          className={PAD}
          aria-label={t('sims.arena.manual.right')}
          {...hold(-1)}
        >
          →
        </button>
      </div>
      <p className="font-mono text-xs text-fg-muted">{`ω ${drive.base_radps} rad/s · ${t('sims.arena.manual.keys')}`}</p>
    </div>
  );
}

function ControllerPicker({ api }: { api: ArenaSettingsApi }): JSX.Element {
  const t = useT();
  const { settings, update } = api;
  return (
    <div role="radiogroup" aria-label={t('sims.arena.controller.label')} className={SEGMENT}>
      {CONTROLLER_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={settings.controller === id}
          className={segmentButton(settings.controller === id)}
          onClick={() => update({ controller: id })}
        >
          {t(`sims.arena.controller.${id}`)}
        </button>
      ))}
    </div>
  );
}

/** Race against the reference ghost, and the sensor noise. */
function RaceToggles({ api }: { api: ArenaSettingsApi }): JSX.Element {
  const t = useT();
  const { settings, update } = api;
  return (
    <>
      <label className="flex items-start gap-3 border-t border-border pt-3">
        <input
          type="checkbox"
          className="mt-1 accent-primary"
          checked={settings.ghost}
          onChange={(event) => update({ ghost: event.target.checked })}
        />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-fg">{t('sims.arena.ghost')}</span>
          <span className="text-xs text-fg-muted">{t('sims.arena.ghostHint')}</span>
        </span>
      </label>
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          className="accent-primary"
          checked={settings.noise}
          onChange={(event) => update({ noise: event.target.checked })}
        />
        <span className="text-sm font-medium text-fg">{t('sims.arena.noise')}</span>
      </label>
    </>
  );
}

export interface ControlTabProps {
  readonly spec: MobileSpec;
  readonly api: ArenaSettingsApi;
  readonly drive: ManualDriveApi;
}

/** The controller selector, its gains with a line on what each one does, and the race toggles. */
export function ControlTab({ spec, api, drive }: ControlTabProps): JSX.Element {
  const t = useT();
  const { settings, setParam } = api;
  const params = controllerParams(
    settings.controller,
    settings.params[settings.controller],
    spec,
    t,
  );
  const base = settings.params[settings.controller]['omegaBase_radps'];
  return (
    <div className="flex flex-col gap-4">
      <ControllerPicker api={api} />
      <p className="text-sm text-fg-muted">
        {t(`sims.arena.controllerHint.${settings.controller}`)}
      </p>
      {settings.controller === 'manual' ? (
        <ManualPad drive={drive} />
      ) : (
        params.map((param) => <Slider key={param.key} param={param} onChange={setParam} />)
      )}
      {base === undefined || settings.controller === 'manual' ? null : (
        <p className="font-mono text-xs text-physical">
          {t('sims.arena.speedOf', { speed: speedOf(spec, base) })}
        </p>
      )}
      <RaceToggles api={api} />
    </div>
  );
}
