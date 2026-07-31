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
