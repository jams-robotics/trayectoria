// Pure model of the «Pasos» mode of the free arena: the program a child builds with big buttons
// (forward, turn, repeat) and its expansion into the plain moves the robot executes. No React.

/** One cell of the grid the child counts, in metres. */
export const CELL_M = 0.25;
export const MAX_STEPS = 30;
export const MIN_REPEAT = 2;
export const MAX_REPEAT = 9;

export type Move = 'forward' | 'left' | 'right';

/** A button of the program: a move, «Repetir ×n» (opens a block) or «Fin repetir» (closes it). */
export type Step =
  | { readonly kind: Move }
  | { readonly kind: 'repeat'; readonly n: number }
  | { readonly kind: 'end' };

export type Program = readonly Step[];

/** A move to execute and the position in the program of the button it came from. */
export interface Action {
  readonly move: Move;
  readonly index: number;
}

/** True while a «Repetir» is open: the program ends inside it. Nesting is one level deep. */
export function repeatOpen(program: Program): boolean {
  let open = false;
  for (const step of program) {
    if (step.kind === 'repeat') open = true;
    else if (step.kind === 'end') open = false;
  }
  return open;
}

/** Whether `step` can be added after `program`; the buttons grey out when it cannot. */
export function canAdd(program: Program, step: Step): boolean {
  if (program.length >= MAX_STEPS) return false;
  if (step.kind === 'repeat')
    return !repeatOpen(program) && step.n >= MIN_REPEAT && step.n <= MAX_REPEAT;
  if (step.kind === 'end') return repeatOpen(program);
  return true;
}

/** `program` with `step` at the end, or the same program when it cannot go there. */
export function addStep(program: Program, step: Step): Program {
  return canAdd(program, step) ? [...program, step] : program;
}

/** Without the last button. */
export function removeLast(program: Program): Program {
  return program.slice(0, -1);
}

/** The moves of `program`, each block repeated; a block left open runs up to the end. */
export function expand(program: Program): readonly Action[] {
  const out: Action[] = [];
  let block: Action[] | null = null;
  let times = 1;
  const close = (): void => {
    for (let i = 0; i < times; i += 1) out.push(...(block ?? []));
    block = null;
  };
  program.forEach((step, index) => {
    if (step.kind === 'repeat') {
      block = [];
      times = step.n;
    } else if (step.kind === 'end') close();
    else (block ?? out).push({ move: step.kind, index });
  });
  if (block !== null) close();
  return out;
}
