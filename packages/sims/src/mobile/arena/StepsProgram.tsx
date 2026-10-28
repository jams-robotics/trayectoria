import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import { MAX_STEPS } from './steps';
import type { Program } from './steps';
import { stepLabel } from './stepLabel';
import type { StepsApi } from './useSteps';

export const SMALL =
  'min-h-10 rounded-md border border-border bg-bg px-4 text-base font-semibold text-fg hover:border-primary disabled:opacity-40 disabled:hover:border-border';

/** How deep in a «Repetir» each button of the program sits: 1 between «Repetir» and «Fin». */
function depths(program: Program): readonly number[] {
  let depth = 0;
  return program.map((step) => {
    if (step.kind === 'end') depth = 0;
    const here = depth;
    if (step.kind === 'repeat') depth = 1;
    return here;
  });
}

function rowClass(current: boolean, blocked: boolean): string {
  if (blocked) return 'border-error bg-error text-bg';
  return current ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-bg text-fg';
}

/** The program as a scrolling list with a glyph per button; the running one is highlighted. */
export function ProgramList({ steps }: { steps: StepsApi }): JSX.Element {
  const t = useT();
  const indent = depths(steps.program);
  const at = steps.status?.index ?? null;
  const blocked = steps.status?.state === 'blocked';
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-fg-muted">
        {`${t('sims.arena.steps.program')} · ${t('sims.arena.steps.count', { count: steps.program.length, max: MAX_STEPS })}`}
      </p>
      {steps.program.length === 0 ? (
        <p className="text-base text-fg-muted">{t('sims.arena.steps.empty')}</p>
      ) : (
        <ol
          className="flex max-h-[40vh] flex-col gap-1 overflow-y-auto pr-1"
          aria-label={t('sims.arena.steps.program')}
        >
          {steps.program.map((step, i) => {
            const { glyph, label } = stepLabel(t, step);
            return (
              <li
                key={`${i}-${step.kind}`}
                aria-current={at === i ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-base font-semibold ${rowClass(at === i, blocked && at === i)} ${indent[i] === 1 ? 'ml-4' : ''}`}
              >
                <span aria-hidden="true" className="w-4 text-center text-xl">
                  {glyph}
                </span>
                {label}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** «Ejecutar» big, «Borrar último» and «Limpiar» beside it. */
export function ProgramActions({
  steps,
  onRun,
}: {
  steps: StepsApi;
  onRun: () => void;
}): JSX.Element {
  const t = useT();
  const empty = steps.program.length === 0;
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        className="col-span-2 min-h-12 rounded-lg bg-primary px-4 text-xl font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-40"
        disabled={empty}
        onClick={onRun}
      >
        {`▶ ${t('sims.arena.steps.run')}`}
      </button>
      <button type="button" className={SMALL} disabled={empty} onClick={steps.undo}>
        {t('sims.arena.steps.undo')}
      </button>
      <button type="button" className={SMALL} disabled={empty} onClick={steps.clear}>
        {t('sims.arena.steps.clear')}
      </button>
    </div>
  );
}
