import { describe, expect, it } from 'vitest';

import { canStartDash, DASH, dashVelocity } from './dashMath';

describe('phase dash rules', () => {
  it('requires the permanent ability and an available charge', () => {
    expect(canStartDash(false, true, true)).toBe(false);
    expect(canStartDash(true, false, true)).toBe(false);
    expect(canStartDash(true, true, false)).toBe(false);
    expect(canStartDash(true, true, true)).toBe(true);
  });

  it('uses facing when input direction is neutral', () => {
    expect(dashVelocity(0)).toBe(DASH.speed);
    expect(dashVelocity(-1)).toBe(-DASH.speed);
  });
});
