import { describe, expect, it } from 'vitest';

import {
  canWallJump,
  canWallSlide,
  cappedWallSlideVelocity,
  WALL_JUMP,
  wallContactDirection,
  wallJumpFacingInputAllowed,
  wallJumpVelocity,
} from './wallJumpMath';

describe('magnetic wall jump', () => {
  it('caps a descending player at the 55px/s wall-slide baseline', () => {
    expect(canWallSlide(true, false, 1, 180)).toBe(true);
    expect(cappedWallSlideVelocity(180)).toBe(WALL_JUMP.slideSpeed);
    expect(cappedWallSlideVelocity(32)).toBe(32);
  });

  it('requires the ability, wall contact and a buffered jump', () => {
    expect(canWallJump(true, false, -1, true)).toBe(true);
    expect(canWallJump(false, false, -1, true)).toBe(false);
    expect(canWallJump(true, true, -1, true)).toBe(false);
  });

  it('launches away from either contacted wall', () => {
    expect(wallContactDirection(true, false)).toBe(-1);
    expect(wallJumpVelocity(-1)).toEqual({ x: 190, y: -290 });
    expect(wallJumpVelocity(1)).toEqual({ x: -190, y: -290 });
  });

  it('preserves the away-facing direction during the wall-jump lock', () => {
    expect(wallJumpFacingInputAllowed(100, 220)).toBe(false);
    expect(wallJumpFacingInputAllowed(220, 220)).toBe(true);
  });
});
