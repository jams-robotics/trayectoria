import { expect, it } from 'vitest';

it('CI failure check: this test must fail', () => {
  expect(1).toBe(2);
});
