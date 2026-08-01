export interface LeapVelocity {
  x: number;
  y: number;
}

export function sporeLeapVelocity(playerX: number, enemyX: number): LeapVelocity {
  const distance = playerX - enemyX;
  const direction = distance === 0 ? 1 : Math.sign(distance);
  return {
    x: direction * Math.min(82, 48 + Math.abs(distance) * 0.16),
    y: -218,
  };
}

/** 炮台的索敌范围。超出后不再开火，避免隔着整个房间和墙壁定时打冷枪。 */
export const TURRET_SIGHT = {
  range: 200,
  verticalReach: 120,
} as const;

export function turretCanFire(
  turretX: number,
  turretY: number,
  playerX: number,
  playerY: number,
): boolean {
  return (
    Math.abs(playerX - turretX) <= TURRET_SIGHT.range &&
    Math.abs(playerY - turretY) <= TURRET_SIGHT.verticalReach
  );
}

/**
 * 爬行体原先只在 blocked.left/right 时掉头，走到平台边缘会直接踏空掉下去。
 * 悬崖检测让它在没有落脚点时也折返。
 */
export function shouldTurnAround(blockedSide: boolean, groundAhead: boolean): boolean {
  return blockedSide || !groundAhead;
}
