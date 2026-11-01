import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import { DUO_LAPS } from './duoRace';
import type { ArenaSettingsApi } from './useArenaSettings';

const BUTTON =
  'min-h-10 rounded-md border border-border bg-bg px-4 text-base font-semibold text-fg hover:border-primary';

/** The side panel of a two-player race: what wins, which keys each one uses, restart and the way back. */
export function DuoPanel({
  api,
  onRestart,
}: {
  api: ArenaSettingsApi;
  onRestart: () => void;
}): JSX.Element {
  const t = useT();
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-bg-raised/90 p-4 shadow-md backdrop-blur">
      <h2 className="text-xl font-semibold text-fg">{t('sims.arena.duo.title')}</h2>
      <p className="text-base text-fg">
        {api.settings.free
          ? t('sims.arena.duo.leadStars')
          : t('sims.arena.duo.leadLaps', { laps: DUO_LAPS })}
      </p>
      <p className="text-sm text-fg-muted">{t('sims.arena.duo.keys')}</p>
      <button type="button" className={BUTTON} onClick={onRestart}>
        {t('sims.arena.free.restart')}
      </button>
      <button type="button" className={BUTTON} onClick={() => api.setPlayers(1)}>
        {t('sims.arena.duo.back')}
      </button>
    </section>
  );
}

/** «2 jugadores», to switch the race to two players from the panels of the free arena and the track. */
export function DuoToggle({ api }: { api: ArenaSettingsApi }): JSX.Element {
  const t = useT();
  return (
    <button type="button" className={BUTTON} onClick={() => api.setPlayers(2)}>
      {t('sims.arena.duo.start')}
    </button>
  );
}
