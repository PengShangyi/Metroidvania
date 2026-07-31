export const COMBAT = {
  playerInvulnerabilityMs: 650,
  blasterCooldownMs: 180,
  bladeCooldownMs: 360,
  projectileSpeed: 320,
  projectileLifetimeMs: 900,
} as const;

export interface DamageResult {
  applied: boolean;
  health: number;
  invulnerableUntil: number;
}

export function resolveDamage(
  health: number,
  amount: number,
  now: number,
  invulnerableUntil: number,
): DamageResult {
  if (now < invulnerableUntil || amount <= 0) {
    return { applied: false, health, invulnerableUntil };
  }
  return {
    applied: true,
    health: Math.max(0, health - amount),
    invulnerableUntil: now + COMBAT.playerInvulnerabilityMs,
  };
}

export function cooldownReady(now: number, readyAt: number): boolean {
  return now >= readyAt;
}
