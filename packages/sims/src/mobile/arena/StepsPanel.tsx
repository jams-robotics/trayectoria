import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import { MAX_REPEAT, MIN_REPEAT, canAdd } from './steps';
import type { Step } from './steps';
import { stepLabel } from './stepLabel';
import type { StepGoal } from './stepGoals';
import { SMALL } from './StepsProgram';
import type { StepsApi } from './useSteps';
import type { ArenaSettingsApi } from './useArenaSettings';

const BIG =
  'flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border bg-bg px-3 text-lg font-semibold text-fg hover:border-primary disabled:opacity-40 disabled:hover:border-border';

const GOALS: ReadonlyArray<StepGoal | null> = [null, 'square', 'star'];

function StepButton({ step, steps }: { step: Step; steps: StepsApi }): JSX.Element {
  const t = useT();
  const { glyph, label } = stepLabel(t, step);
  return (
    <button
      type="button"
      className={BIG}
      disabled={!canAdd(steps.program, step)}
      onClick={() => steps.add(step)}
    >
      <span aria-hidden="true">{glyph}</span>
      {label}
    </button>
  );
}

/** The `n` of «Repetir ×n», between 2 and 9, with its own − and +. */
function RepeatPicker({ steps }: { steps: StepsApi }): JSX.Element {
  const t = useT();
  const n = steps.repeatN;
  return (
    <div
      className="flex items-center justify-between gap-2"
      role="group"
      aria-label={t('sims.arena.steps.repeatTimes')}
    >
      <button
        type="button"
        className={SMALL}
        aria-label={t('sims.arena.steps.less')}
        disabled={n <= MIN_REPEAT}
        onClick={() => steps.setRepeatN(n - 1)}
      >
        −
      </button>
      <span className="font-mono text-2xl font-semibold text-fg">{`×${n}`}</span>
      <button
        type="button"
        className={SMALL}
        aria-label={t('sims.arena.steps.more')}
        disabled={n >= MAX_REPEAT}
        onClick={() => steps.setRepeatN(n + 1)}
      >
        +
      </button>
    </div>
  );
}

function Palette({ steps }: { steps: StepsApi }): JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2 grid grid-cols-1 gap-2">
        <StepButton step={{ kind: 'forward' }} steps={steps} />
      </div>
      <StepButton step={{ kind: 'left' }} steps={steps} />
      <StepButton step={{ kind: 'right' }} steps={steps} />
      <StepButton step={{ kind: 'repeat', n: steps.repeatN }} steps={steps} />
      <RepeatPicker steps={steps} />
      <div className="col-span-2 grid grid-cols-1 gap-2">
        <StepButton step={{ kind: 'end' }} steps={steps} />
      </div>
    </div>
  );
}

function GoalPicker({ api, onPick }: { api: ArenaSettingsApi; onPick: () => void }): JSX.Element {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('sims.arena.steps.goalLabel')}>
      {GOALS.map((goal) => (
        <button
          key={goal ?? 'free'}
          type="button"
          className={`${SMALL} ${api.settings.stepGoal === goal ? 'border-primary bg-primary text-primary-fg' : ''}`}
          aria-pressed={api.settings.stepGoal === goal}
          onClick={() => {
            api.update({ stepGoal: goal });
            onPick();
          }}
        >
          {t(`sims.arena.steps.goal.${goal ?? 'free'}`)}
        </button>
      ))}
    </div>
  );
}

/** The goal, the big buttons that build the program and the way back to driving by keys. */
export function StepsPanel({
  api,
  steps,
}: {
  api: ArenaSettingsApi;
  steps: StepsApi;
}): JSX.Element {
  const t = useT();
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-bg-raised/90 p-4 shadow-md backdrop-blur">
      <h2 className="text-xl font-semibold text-fg">{t('sims.arena.steps.title')}</h2>
      <p className="text-sm text-fg-muted">{t('sims.arena.steps.lead')}</p>
      <GoalPicker api={api} onPick={steps.stop} />
      <Palette steps={steps} />
      <button
        type="button"
        className={SMALL}
        onClick={() => api.update({ steps: false, stepGoal: null })}
      >
        {t('sims.arena.steps.exit')}
      </button>
    </section>
  );
}
