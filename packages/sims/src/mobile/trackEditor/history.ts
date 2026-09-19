/** Largest number of past states kept for undo. */
export const HISTORY_LIMIT = 100;

/** Undo and redo stacks around the current value. */
export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

/** A history holding `initial` with nothing to undo or redo. */
export function createHistory<T>(initial: T): History<T> {
  return { past: [], present: initial, future: [] };
}

/** Records `state` as the present, dropping the redo stack and the oldest past states. */
export function push<T>(history: History<T>, state: T): History<T> {
  const past = [...history.past, history.present];
  return {
    past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past,
    present: state,
    future: [],
  };
}

/** True when there is a past state to go back to. */
export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

/** True when there is a state to go forward to. */
export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

/** Steps back one state, or returns `history` unchanged when there is nothing to undo. */
export function undo<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) {
    return history;
  }
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

/** Steps forward one state, or returns `history` unchanged when there is nothing to redo. */
export function redo<T>(history: History<T>): History<T> {
  const next = history.future[0];
  if (next === undefined) {
    return history;
  }
  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}
