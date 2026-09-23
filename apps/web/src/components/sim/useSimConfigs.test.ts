import { describe, expect, it } from 'vitest';

import { saveErrorKey } from './useSimConfigs';

// #210 (decision 5): the notice the page shows when saving a configuration fails. The adapter
// (`simConfigPersistence.ts`) reports both the precheck and the `23514` of the size check of the
// database as a `RangeError`, and its own tests prove that; what is checked here is that this
// error, and only this one, becomes the too-large notice.

describe('saveErrorKey (#210)', () => {
  it('shows the too-large notice for a RangeError of the size bound', () => {
    expect(saveErrorKey(new RangeError('robot spec over the stored JSON bound'))).toBe(
      'sims.simConfig.tooLarge',
    );
  });

  it('keeps the generic notice for any other error', () => {
    expect(saveErrorKey(new Error('denegado'))).toBe('sims.simConfig.saveError');
    expect(saveErrorKey('nope')).toBe('sims.simConfig.saveError');
  });
});
