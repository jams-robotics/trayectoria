import type { JSX } from 'react';
import { useT } from '@trayectoria/i18n';

import { MAX_STEPS, canMove } from './steps';
import type { Program } from './steps';
import { stepLabel } from './stepLabel';
import type { StepsApi } from './useSteps';

export const SMALL =
  'min-h-8 rounded-md border border-border bg-bg px-4 text-base font-semibold text-fg hover:border-primary disabled:opacity-40 disabled:hover:border-border';

/** Square icon button of a program row: up, down or remove. */
const ICON =
  'flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-bg text-base text-fg hover:border-primary disabled:opacity-30 disabled:hover:border-border';

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

/** Up, down and remove for the button at `index`; up and down grey out where the block breaks. */
function RowTools({ steps, index }: { steps: StepsApi; index: number }): JSX.Element {
  const t = useT();
  const n = { n: index + 1 };
  return (
    <>
      <button
        type="button"
        className={ICON}
        aria-label={t('sims.arena.steps.moveUp', n)}
        disabled={!canMove(steps.program, index, -1)}
        onClick={() => steps.move(index, -1)}
      >
        ↑
      </button>
      <button
        type="button"
        className={ICON}
        aria-label={t('sims.arena.steps.moveDown', n)}
        disabled={!canMove(steps.program, index, 1)}
        onClick={() => steps.move(index, 1)}
      >
        ↓
      </button>
      <button
        type="button"
        className={ICON}
        aria-label={t('sims.arena.steps.remove', n)}
        onClick={() => steps.remove(index)}
      >
        ✕
      </button>
    </>
  );
}

/** One button of the program with its number, and the controls to move it or take it out. */
function ProgramRow(props: {
  steps: StepsApi;
  index: number;
  depth: number;
  current: boolean;
  blocked: boolean;
}): JSX.Element {
  const t = useT();
  const { steps, index } = props;
  const step = steps.program[index];
  if (step === undefined) return <></>;
  const { glyph, label } = stepLabel(t, step);
  return (
    <li
      aria-current={props.current ? 'step' : undefined}
      className={`flex items-center gap-2 rounded-md border py-1 pr-1 pl-3 text-base font-semibold ${rowClass(props.current, props.blocked)} ${props.depth === 1 ? 'ml-4' : ''}`}
    >
      <span aria-hidden="true" className="w-5 text-right font-mono text-xs opacity-70">
        {index + 1}
      </span>
      <span aria-hidden="true" className="w-4 text-center text-xl">
        {glyph}
      </span>
      <span className="flex-1">{label}</span>
      <RowTools steps={steps} index={index} />
    </li>
  );
}

/** The program as a scrolling list; the running button is highlighted and each one can move or go. */
export function ProgramList({ steps }: { steps: StepsApi }): JSX.Element {
  const t = useT();
  const indent = depths(steps.program);
  const at = steps.status?.index ?? null;
  const blocked = steps.status?.state === 'blocked';
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <h2 className="text-lg font-semibold text-fg">
        {t('sims.arena.steps.program')}
        <span className="ml-2 text-sm font-normal text-fg-muted">
          {t('sims.arena.steps.count', { count: steps.program.length, max: MAX_STEPS })}
        </span>
      </h2>
      {steps.program.length === 0 ? (
        <p className="text-base text-fg-muted">{t('sims.arena.steps.empty')}</p>
      ) : (
        <ol
          className="flex min-h-0 flex-col gap-1 overflow-y-auto pr-1 max-lg:max-h-[50vh]"
          aria-label={t('sims.arena.steps.program')}
        >
          {steps.program.map((step, i) => (
            <ProgramRow
              key={`${i}-${step.kind}`}
              steps={steps}
              index={i}
              depth={indent[i] ?? 0}
              current={at === i}
              blocked={blocked && at === i}
            />
          ))}
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
    <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
      <button
        type="button"
        className="col-span-2 min-h-10 rounded-lg bg-primary px-4 text-xl font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-40"
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

/**
 * The program beside the arena, on the side the free floor leaves empty: always in view while the
 * palette builds it, with «Ejecutar» at its foot (#698).
 */
export function ProgramPanel({
  steps,
  onRun,
}: {
  steps: StepsApi;
  onRun: () => void;
}): JSX.Element {
  return (
    <section className="flex min-h-0 flex-col gap-3 rounded-lg border border-border bg-bg-raised/90 p-4 shadow-md backdrop-blur lg:max-h-full">
      <ProgramList steps={steps} />
      <ProgramActions steps={steps} onRun={onRun} />
    </section>
  );
}
