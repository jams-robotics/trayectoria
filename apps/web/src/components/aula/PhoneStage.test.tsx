// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { ClassMessage } from '../../lib/aula/classChannel';
import { RunStatus } from './PhoneStage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const RUN = { kind: 'progress', collected: 5, total: 5, time_s: 49.43, done: true } as const;

describe('RunStatus', () => {
  test('a finished run shows the result and «Jugar otra vez» restarts it', () => {
    const sent: ClassMessage[] = [];
    act(() => root.render(<RunStatus progress={RUN} send={(message) => sent.push(message)} />));
    const done = container.querySelector('[data-testid="phone-run-done"]');
    expect(done?.textContent).toContain('5 de 5');
    expect(done?.textContent).toContain('49.4 s');
    act(() => done?.querySelector('button')?.click());
    expect(sent).toEqual([{ kind: 'restart' }]);
  });

  test('a run under way shows stars and time; a track shows nothing', () => {
    act(() =>
      root.render(<RunStatus progress={{ ...RUN, collected: 2, done: false }} send={() => {}} />),
    );
    expect(container.textContent).toContain('2/5');
    act(() => root.render(<RunStatus progress={null} send={() => {}} />));
    expect(container.textContent).toBe('');
  });
});
