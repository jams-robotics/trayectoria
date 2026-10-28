import { useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { MobileSpec } from '@trayectoria/robot-spec';

import { ChallengesTab } from './ChallengesTab';
import type { ChallengeId } from './challenges';
import { ControlTab, SEGMENT, segmentButton } from './ControlTab';
import { TrackTab } from './TrackTab';
import type { ArenaSettingsApi } from './useArenaSettings';
import type { ManualDriveApi } from './useManualDrive';

type TabId = 'control' | 'track' | 'challenges';
const TABS: readonly TabId[] = ['control', 'track', 'challenges'];

export interface ArenaPanelProps {
  readonly spec: MobileSpec;
  readonly api: ArenaSettingsApi;
  readonly drive: ManualDriveApi;
  readonly passed: ReadonlySet<ChallengeId>;
  readonly robotHref: string;
}

/** The side panel: the controller and its gains, the track, and the challenges. */
export function ArenaPanel({ spec, api, drive, passed, robotHref }: ArenaPanelProps): JSX.Element {
  const t = useT();
  const [tab, setTab] = useState<TabId>('control');
  const startChallenge = (id: ChallengeId): void => {
    api.startChallenge(id);
    setTab('control');
  };
  return (
    <section
      className="flex flex-col gap-4 rounded-lg border border-border bg-bg-raised/90 p-4 shadow-md backdrop-blur"
      aria-label={t('sims.arena.tabs.label')}
    >
      <div role="tablist" aria-label={t('sims.arena.tabs.label')} className={SEGMENT}>
        {TABS.map((id) => (
          <button
            key={id}
            id={`arena-tab-${id}`}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={`arena-tabpanel-${id}`}
            className={segmentButton(tab === id)}
            onClick={() => setTab(id)}
          >
            {t(`sims.arena.tabs.${id}`)}
          </button>
        ))}
      </div>
      <div id={`arena-tabpanel-${tab}`} role="tabpanel" aria-labelledby={`arena-tab-${tab}`}>
        {tab === 'control' ? <ControlTab spec={spec} api={api} drive={drive} /> : null}
        {tab === 'track' ? <TrackTab api={api} robotHref={robotHref} /> : null}
        {tab === 'challenges' ? (
          <ChallengesTab active={api.settings.challenge} passed={passed} onStart={startChallenge} />
        ) : null}
      </div>
    </section>
  );
}
