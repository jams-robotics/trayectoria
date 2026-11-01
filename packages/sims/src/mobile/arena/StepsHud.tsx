import { useState } from 'react';
import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';
import type { Translate } from '@trayectoria/i18n';

import { Celebration } from './Celebration';
import { HUD_CARD } from './ArenaHud';
import { goalMet } from './stepGoals';
import type { StepGoal } from './stepGoals';
import { expand } from './steps';
import type { StepsApi } from './useSteps';
import type { ArenaSnapshot } from './useArenaLoop';

const GOAL_KEY = (goal: StepGoal | null): string => goal ?? 'free';

/** What the robot is doing or why it stopped, in a sentence a child reads at a glance. */
function messageOf(t: Translate, steps: StepsApi, goal: StepGoal | null, met: boolean): string {
  const { status } = steps;
  if (status === null || met) return t(`sims.arena.steps.hint.${GOAL_KEY(goal)}`);
  const n = (status.index ?? 0) + 1;
  if (status.state === 'running') return t('sims.arena.steps.running', { n });
  if (status.state === 'blocked') return t('sims.arena.steps.blocked', { n });
  if (goal === 'square') return t('sims.arena.steps.missSquare');
  return goal === 'star' ? t('sims.arena.steps.missStar') : t('sims.arena.steps.finished');
}

export interface StepsLayerProps {
  readonly steps: StepsApi;
  readonly goal: StepGoal | null;
  readonly snapshot: ArenaSnapshot | null;
  readonly onRestart: () => void;
}

/** Over the canvas in «Pasos»: what the robot is doing and the celebration of a solved goal. */
export function StepsLayer({ steps, goal, snapshot, onRestart }: StepsLayerProps): JSX.Element {
  const t = useT();
  // The run a closed celebration was for: the next run, solved again, celebrates again.
  const [closedRun, setClosedRun] = useState(0);
  const met =
    snapshot !== null &&
    steps.status !== null &&
    goalMet(
      goal,
      expand(steps.program),
      steps.status.state === 'done',
      snapshot.you.state.robot,
      snapshot.free?.done === true,
    );
  const celebrate = met && steps.runId !== closedRun;
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-12 z-10 flex justify-center px-3">
        <p
          className={`${HUD_CARD} max-w-form-card px-4 py-3 text-center text-base font-semibold text-fg`}
          role="status"
        >
          {messageOf(t, steps, goal, met)}
        </p>
      </div>
      {celebrate ? (
        <Celebration
          heading={t('sims.arena.steps.done')}
          title={t(`sims.arena.steps.${goal === 'star' ? 'doneStar' : 'doneSquare'}`)}
          learned={t(`sims.arena.steps.${goal === 'star' ? 'learnedStar' : 'learnedSquare'}`)}
          nextLabel={t('sims.arena.steps.again')}
          closeLabel={t('sims.arena.steps.close')}
          onNext={onRestart}
          onClose={() => setClosedRun(steps.runId)}
        />
      ) : null}
    </>
  );
}
