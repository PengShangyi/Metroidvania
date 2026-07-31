import { describe, expect, it } from 'vitest';

import { sporeLeapVelocity } from './aiMath';

describe('spore leaper', () => {
  it('leaps toward the player and caps horizontal speed', () => {
    expect(sporeLeapVelocity(200, 100)).toEqual({ x: 64, y: -218 });
    expect(sporeLeapVelocity(-500, 100)).toEqual({ x: -82, y: -218 });
  });
});
