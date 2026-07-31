import { describe, expect, it } from 'vitest';

import { hitReaction, projectileImpactKind } from './feedbackRules';

describe('combat hit reactions', () => {
  it('keeps blaster feedback lighter than close-range attacks', () => {
    const blaster = hitReaction('blaster');
    const blade = hitReaction('blade');

    expect(blaster.hitStopMs).toBe(24);
    expect(blaster.stunMs).toBe(100);
    expect(blaster.knockbackSpeed).toBeLessThan(blade.knockbackSpeed);
    expect(blaster.shakesCamera).toBe(false);
  });

  it('gives fused attacks the full hit reaction', () => {
    expect(hitReaction('piercing')).toMatchObject({ hitStopMs: 38, stunMs: 160 });
    expect(hitReaction('reflected')).toMatchObject({ hitStopMs: 38, stunMs: 160 });
  });

  it('maps projectile kinds to their matching feedback strength', () => {
    expect(projectileImpactKind('blaster')).toBe('blaster');
    expect(projectileImpactKind('piercing')).toBe('piercing');
    expect(projectileImpactKind('reflected')).toBe('reflected');
    expect(projectileImpactKind('bossVolley')).toBe('blaster');
  });
});
