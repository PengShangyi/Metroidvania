import { describe, expect, it } from 'vitest';

import { BOSS, bossAttackAt, bossCadence, bossPhase } from './rules';

describe('Core Guardian rules', () => {
  it('enters phase two at half health', () => {
    expect(bossPhase(BOSS.maxHealth)).toBe(1);
    expect(bossPhase(BOSS.phaseTwoHealth + 1)).toBe(1);
    expect(bossPhase(BOSS.phaseTwoHealth)).toBe(2);
  });

  it('uses all three telegraphed attacks and accelerates in phase two', () => {
    expect(new Set([0, 1, 2].map((serial) => bossAttackAt(serial, 1)))).toEqual(
      new Set(['volley', 'beam', 'shockwave']),
    );
    expect(bossCadence(2)).toBeLessThan(bossCadence(1));
  });
});
