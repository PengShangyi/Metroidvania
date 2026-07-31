import { describe, expect, it } from 'vitest';

import {
  canConsumeJump,
  horizontalAcceleration,
  MOVEMENT,
  shortenedJumpVelocity,
} from './movementMath';

describe('movement math', () => {
  it('accepts buffered jumps inside the coyote window', () => {
    expect(canConsumeJump(1_000, 920, 1_080)).toBe(true);
    expect(canConsumeJump(1_000, 899, 1_080)).toBe(false);
    expect(canConsumeJump(1_000, 950, 999)).toBe(false);
  });

  it('turns horizontal input into signed acceleration', () => {
    expect(horizontalAcceleration(-1)).toBe(-MOVEMENT.acceleration);
    expect(horizontalAcceleration(0)).toBe(0);
    expect(horizontalAcceleration(0.4)).toBe(MOVEMENT.acceleration);
  });

  it('shortens only an ascending jump', () => {
    expect(shortenedJumpVelocity(-200)).toBeCloseTo(-110);
    expect(shortenedJumpVelocity(80)).toBe(80);
  });
});
