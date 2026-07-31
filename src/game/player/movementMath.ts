export const MOVEMENT = {
  speed: 110,
  acceleration: 1000,
  deceleration: 1400,
  gravity: 900,
  maxFallSpeed: 360,
  jumpVelocity: -300,
  coyoteMs: 100,
  jumpBufferMs: 120,
} as const;

export function canConsumeJump(now: number, groundedAt: number, bufferedUntil: number): boolean {
  return bufferedUntil >= now && now - groundedAt <= MOVEMENT.coyoteMs;
}

export function horizontalAcceleration(inputX: number): number {
  if (inputX === 0) return 0;
  return Math.sign(inputX) * MOVEMENT.acceleration;
}

export function shortenedJumpVelocity(velocityY: number): number {
  return velocityY < 0 ? velocityY * 0.55 : velocityY;
}
