import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDriveSender, parseMessage, topicOf, type ClassMessage } from './classChannel';
import { tokenFromHash } from './classSession';

describe('parseMessage', () => {
  it('accepts the three known shapes', () => {
    expect(parseMessage({ kind: 'drive', steer: 1, go: -1 })).toEqual({
      kind: 'drive',
      steer: 1,
      go: -1,
    });
    expect(parseMessage({ kind: 'param', key: 'kp', value: 2.5 })).toEqual({
      kind: 'param',
      key: 'kp',
      value: 2.5,
    });
    expect(parseMessage({ kind: 'turn', active: true })).toEqual({ kind: 'turn', active: true });
  });

  it('accepts restart, a phone view and the progress of the run', () => {
    expect(parseMessage({ kind: 'restart' })).toEqual({ kind: 'restart' });
    expect(parseMessage({ kind: 'camera', mode: 'onboard' })).toEqual({
      kind: 'camera',
      mode: 'onboard',
    });
    const progress = { kind: 'progress', collected: 3, total: 5, time_s: 12.4, done: false };
    expect(parseMessage(progress)).toEqual(progress);
  });

  it('rejects views a phone cannot pick and progress out of range', () => {
    expect(parseMessage({ kind: 'camera', mode: 'cinema' })).toBeNull();
    expect(parseMessage({ kind: 'camera' })).toBeNull();
    const progress = { kind: 'progress', collected: 3, total: 5, time_s: 12.4, done: false };
    expect(parseMessage({ ...progress, collected: -1 })).toBeNull();
    expect(parseMessage({ ...progress, total: 2.5 })).toBeNull();
    expect(parseMessage({ ...progress, time_s: Number.POSITIVE_INFINITY })).toBeNull();
    expect(parseMessage({ ...progress, done: 'yes' })).toBeNull();
  });

  it('rejects anything else', () => {
    expect(parseMessage(null)).toBeNull();
    expect(parseMessage({ kind: 'drive', steer: 2, go: 0 })).toBeNull();
    expect(parseMessage({ kind: 'param', key: 'kp', value: Number.NaN })).toBeNull();
    expect(parseMessage({ kind: 'nope' })).toBeNull();
  });
});

describe('createDriveSender', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends a change at once, repeats at ~15 Hz while held and stops on release', () => {
    const sent: ClassMessage[] = [];
    const sender = createDriveSender((message) => sent.push(message));
    sender.set(1, 0);
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(sent.length).toBeGreaterThanOrEqual(14);
    expect(sent.length).toBeLessThanOrEqual(17);
    sender.set(0, 0);
    const total = sent.length;
    vi.advanceTimersByTime(1000);
    expect(sent).toHaveLength(total + 0);
    expect(sent.at(-1)).toEqual({ kind: 'drive', steer: 0, go: 0 });
  });
});

describe('class session links', () => {
  it('builds the topic and reads the token of the fragment', () => {
    expect(topicOf('s', 'u')).toBe('aula:s:u');
    expect(tokenFromHash('#t=abc')).toBe('abc');
    expect(tokenFromHash('')).toBe('');
  });
});
