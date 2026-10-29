import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { CHALLENGES, CLEAN_CIRCUIT_S, OVAL_SPRINT_S, PILOT_S } from './challenges';
import type { Challenge, ChallengeId } from './challenges';

/** Numbers some goals quote, so the text and the check can never disagree. */
const GOAL_PARAMS: Partial<Record<ChallengeId, { seconds: number }>> = {
  pilot: { seconds: PILOT_S },
  ovalSprint: { seconds: OVAL_SPRINT_S },
  cleanCircuit: { seconds: CLEAN_CIRCUIT_S },
};

export function challengeText(
  t: Translate,
  id: ChallengeId,
  part: 'title' | 'goal' | 'learned',
): string {
  return t(`sims.arena.challenges.${id}.${part}`, GOAL_PARAMS[id] ?? {});
}

const LEVEL_CLASS: Record<Challenge['level'], string> = {
  1: 'bg-success/15 text-success',
  2: 'bg-warning/15 text-warning',
  3: 'bg-error/15 text-error',
};

function rowStatus(t: Translate, passed: boolean, active: boolean): string {
  if (passed) return t('sims.arena.challenges.done');
  return active ? t('sims.arena.challenges.active') : '';
}

function ChallengeRow({
  challenge,
  active,
  passed,
  onStart,
}: {
  challenge: Challenge;
  active: boolean;
  passed: boolean;
  onStart: () => void;
}): JSX.Element {
  const t = useT();
  return (
    <li
      className={`flex flex-col gap-2 rounded-md border p-3 ${active ? 'border-primary bg-primary/10' : 'border-border bg-bg'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-fg">{`${passed ? '★ ' : ''}${challengeText(t, challenge.id, 'title')}`}</span>
        <span className={`rounded-full px-2 font-mono text-xs ${LEVEL_CLASS[challenge.level]}`}>
          {t('sims.arena.challenges.level', { level: challenge.level })}
        </span>
      </div>
      <p className="text-sm text-fg-muted">{challengeText(t, challenge.id, 'goal')}</p>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs font-semibold ${passed ? 'text-success' : 'text-fg-muted'}`}>
          {rowStatus(t, passed, active)}
        </span>
        <button
          type="button"
          onClick={onStart}
          className="min-h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
        >
          {t('sims.arena.challenges.start')}
        </button>
      </div>
    </li>
  );
}

export interface ChallengesTabProps {
  readonly active: ChallengeId | null;
  readonly passed: ReadonlySet<ChallengeId>;
  readonly onStart: (id: ChallengeId) => void;
}

export function ChallengesTab({ active, passed, onStart }: ChallengesTabProps): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-fg-muted">{t('sims.arena.challenges.intro')}</p>
      <p className="font-mono text-xs text-physical">
        {t('sims.arena.challenges.doneCount', { done: passed.size, total: CHALLENGES.length })}
      </p>
      <ol className="flex flex-col gap-2">
        {CHALLENGES.map((challenge) => (
          <ChallengeRow
            key={challenge.id}
            challenge={challenge}
            active={active === challenge.id}
            passed={passed.has(challenge.id)}
            onStart={() => onStart(challenge.id)}
          />
        ))}
      </ol>
    </div>
  );
}
