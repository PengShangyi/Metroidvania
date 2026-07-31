import { describe, expect, it } from 'vitest';

import {
  dashCrossingSide,
  SHIELD_CRAWLER,
  shieldCanTakeDamage,
  shieldClosingSoon,
} from './shieldRules';

describe('shield crawler rules', () => {
  it('requires the player to cross the enemy center while overlapping', () => {
    expect(dashCrossingSide(90, 102, 100, true)).toBe(1);
    expect(dashCrossingSide(110, 98, 100, true)).toBe(-1);
    expect(dashCrossingSide(90, 96, 100, true)).toBeUndefined();
    expect(dashCrossingSide(90, 102, 100, false)).toBeUndefined();
  });

  it('only accepts damage from the exposed core side', () => {
    expect(shieldCanTakeDamage('closed', 1, 1)).toBe(false);
    expect(shieldCanTakeDamage('exposed', 1, -1)).toBe(false);
    expect(shieldCanTakeDamage('exposed', 1, 1)).toBe(true);
  });

  it('warns during the final 350ms of the 1.8s exposure', () => {
    const exposedUntil = SHIELD_CRAWLER.exposureMs;
    expect(shieldClosingSoon(1_449, exposedUntil)).toBe(false);
    expect(shieldClosingSoon(1_450, exposedUntil)).toBe(true);
    expect(shieldClosingSoon(1_799, exposedUntil)).toBe(true);
    expect(shieldClosingSoon(1_800, exposedUntil)).toBe(false);
  });
});
