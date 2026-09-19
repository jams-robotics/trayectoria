import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, canRedo, canUndo, createHistory, push, redo, undo } from './history';

describe('track editor history (F4-01a)', () => {
  it('starts with the initial state and nothing to undo or redo', () => {
    const history = createHistory('a');
    expect(history.present).toBe('a');
    expect(history.past).toEqual([]);
    expect(history.future).toEqual([]);
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  it('undoes to the previous state and redoes back', () => {
    const history = push(push(createHistory('a'), 'b'), 'c');
    expect(history.present).toBe('c');

    const undone = undo(history);
    expect(undone.present).toBe('b');
    expect(canUndo(undone)).toBe(true);
    expect(canRedo(undone)).toBe(true);

    const redone = redo(undone);
    expect(redone.present).toBe('c');
    expect(redone.past).toEqual(['a', 'b']);
    expect(redone.future).toEqual([]);
  });

  it('drops the redo stack on a push after an undo', () => {
    const undone = undo(push(push(createHistory('a'), 'b'), 'c'));
    const pushed = push(undone, 'd');
    expect(pushed.present).toBe('d');
    expect(pushed.future).toEqual([]);
    expect(canRedo(pushed)).toBe(false);
    expect(pushed.past).toEqual(['a', 'b']);
  });

  it('is a no-op when there is nothing to undo or redo', () => {
    const history = createHistory('a');
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it(`keeps at most ${HISTORY_LIMIT} past states`, () => {
    let history = createHistory(0);
    for (let step = 1; step <= HISTORY_LIMIT + 10; step += 1) {
      history = push(history, step);
    }
    expect(history.past).toHaveLength(HISTORY_LIMIT);
    expect(history.past[0]).toBe(10);
    expect(history.present).toBe(HISTORY_LIMIT + 10);
  });

  it('does not mutate the history it is given', () => {
    const history = createHistory('a');
    push(history, 'b');
    expect(history.past).toEqual([]);
    expect(history.present).toBe('a');
  });
});
