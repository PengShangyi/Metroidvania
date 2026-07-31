import { describe, expect, it } from 'vitest';

import { COMBAT, cooldownReady, resolveDamage } from './rules';

describe('combat rules', () => {
  it('applies damage and starts invulnerability', () => {
    const result = resolveDamage(5, 2, 1_000, 0);
    expect(result).toEqual({
      applied: true,
      health: 3,
      invulnerableUntil: 1_000 + COMBAT.playerInvulnerabilityMs,
    });
  });

  it('ignores damage during invulnerability', () => {
    expect(resolveDamage(3, 1, 1_200, 1_400)).toEqual({
      applied: false,
      health: 3,
      invulnerableUntil: 1_400,
    });
  });

  it('uses inclusive cooldown boundaries', () => {
    expect(cooldownReady(999, 1_000)).toBe(false);
    expect(cooldownReady(1_000, 1_000)).toBe(true);
  });
});
