export const DASH = {
  speed: 280,
  durationMs: 150,
  invulnerabilityMs: 150,
  cooldownMs: 450,
} as const;

export function canStartDash(
  hasAbility: boolean,
  dashAvailable: boolean,
  pressed: boolean,
): boolean {
  return hasAbility && dashAvailable && pressed;
}

/**
 * 冲刺原先落地即刷新，站在地上连按就能维持 280px/s（走路只有 110），
 * 而且无敌覆盖率接近七成，走位和弹幕都失去了意义。改由冷却驱动：
 * 落地只是必要条件，还得等冷却走完。
 */
export function dashRefreshAllowed(
  now: number,
  cooldownReadyAt: number,
  grounded: boolean,
): boolean {
  return grounded && now >= cooldownReadyAt;
}

export function dashVelocity(direction: number): number {
  return (direction < 0 ? -1 : 1) * DASH.speed;
}
