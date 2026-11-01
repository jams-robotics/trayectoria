import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { MobileSpec } from '@trayectoria/robot-spec';

import { CONTROLLER_IDS, controllerParams } from '../lineFollower/controllers';
import { SEGMENT, Slider, segmentButton } from './ControlTab';
import { isReferenceRival } from './useArenaSettings';
import type { ArenaSettingsApi } from './useArenaSettings';

const RIVAL_CONTROLLERS = CONTROLLER_IDS.filter((id) => id !== 'manual');

function RivalPicker({ api }: { api: ArenaSettingsApi }): JSX.Element {
  const t = useT();
  const { settings, update } = api;
  return (
    <div role="radiogroup" aria-label={t('sims.arena.rival.title')} className={SEGMENT}>
      {RIVAL_CONTROLLERS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={settings.rival === id}
          className={segmentButton(settings.rival === id)}
          onClick={() => update({ rival: id })}
        >
          {t(`sims.arena.controller.${id}`)}
        </button>
      ))}
    </div>
  );
}

/** The rival's own controller and gains, apart from the learner's, to compare two setups. */
export function RivalSection({
  spec,
  api,
}: {
  spec: MobileSpec;
  api: ArenaSettingsApi;
}): JSX.Element {
  const t = useT();
  const { settings, setRivalParam } = api;
  const reference = isReferenceRival(settings);
  const params = controllerParams(settings.rival, settings.rivalParams[settings.rival], spec, t);
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-3">
      <h3 className="text-sm font-semibold text-fg">{t('sims.arena.rival.title')}</h3>
      <RivalPicker api={api} />
      {params.map((param) => (
        <Slider key={param.key} param={param} onChange={setRivalParam} idPrefix="arena-rival" />
      ))}
      {reference ? null : (
        <p className="text-xs text-warning">{t('sims.arena.rival.notReference')}</p>
      )}
    </section>
  );
}
