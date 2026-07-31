export const WALL_JUMP = {
  slideSpeed: 55,
  horizontalVelocity: 190,
  verticalVelocity: -290,
} as const;

export function wallContactDirection(blockedLeft: boolean, blockedRight: boolean): -1 | 0 | 1 {
  if (blockedLeft) return -1;
  if (blockedRight) return 1;
  return 0;
}

export function canWallSlide(
  hasAbility: boolean,
  grounded: boolean,
  wallDirection: number,
  velocityY: number,
): boolean {
  return hasAbility && !grounded && wallDirection !== 0 && velocityY > 0;
}

export function canWallJump(
  hasAbility: boolean,
  grounded: boolean,
  wallDirection: number,
  jumpBuffered: boolean,
): boolean {
  return hasAbility && !grounded && wallDirection !== 0 && jumpBuffered;
}

export function cappedWallSlideVelocity(velocityY: number): number {
  return Math.min(velocityY, WALL_JUMP.slideSpeed);
}

export function wallJumpVelocity(wallDirection: number): { x: number; y: number } {
  const awayFromWall = wallDirection < 0 ? 1 : -1;
  return {
    x: awayFromWall * WALL_JUMP.horizontalVelocity,
    y: WALL_JUMP.verticalVelocity,
  };
}
