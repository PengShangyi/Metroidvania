export const DASH = {
  speed: 280,
  durationMs: 150,
  invulnerabilityMs: 120,
} as const;

export function canStartDash(
  hasAbility: boolean,
  dashAvailable: boolean,
  pressed: boolean,
): boolean {
  return hasAbility && dashAvailable && pressed;
}

export function dashVelocity(direction: number): number {
  return (direction < 0 ? -1 : 1) * DASH.speed;
}
