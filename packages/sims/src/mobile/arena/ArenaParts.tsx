import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import type { ChallengeState } from './arenaHooks';
import { Celebration } from './Celebration';
import { challengeText } from './ChallengesTab';
import type { ArenaRefs } from './useArenaLoop';
import type { ArenaSettings } from './useArenaSettings';

/** The name tag that floats over a robot. */
export function Tag({
  tagRef,
  label,
  className,
}: {
  tagRef: ArenaRefs['youTag'];
  label: string;
  className: string;
}): JSX.Element {
  return (
    <div
      ref={tagRef}
      hidden
      className={`pointer-events-none absolute left-0 top-0 rounded-full px-2 py-1 font-mono text-xs font-semibold shadow-md ${className}`}
    >
      {label}
    </div>
  );
}

export function ChallengeBanner({ settings }: { settings: ArenaSettings }): JSX.Element | null {
  const t = useT();
  if (settings.challenge === null) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-12 z-10 flex justify-center px-3 lg:top-12">
      <p className="max-w-form-card rounded-lg border border-physical bg-bg-raised/90 px-4 py-2 text-center text-sm text-fg shadow-md backdrop-blur">
        <span className="font-semibold text-physical">{`${challengeText(t, settings.challenge, 'title')} · `}</span>
        {challengeText(t, settings.challenge, 'goal')}
      </p>
    </div>
  );
}

export function ChallengeCelebration({
  challenges,
}: {
  challenges: ChallengeState;
}): JSX.Element | null {
  const t = useT();
  const { celebrating } = challenges;
  if (celebrating === null) return null;
  return (
    <Celebration
      heading={t('sims.arena.challenges.passed')}
      title={challengeText(t, celebrating, 'title')}
      learned={challengeText(t, celebrating, 'learned')}
      onNext={challenges.next}
      onClose={challenges.dismiss}
    />
  );
}
