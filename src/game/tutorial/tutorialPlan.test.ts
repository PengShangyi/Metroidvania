import { describe, expect, it } from 'vitest';

import { TUTORIAL_STEPS, tutorialAbilities, tutorialEnemies } from './tutorialPlan';

describe('tutorial plan', () => {
  it('covers movement, combat, both abilities and interaction in order', () => {
    expect(TUTORIAL_STEPS.map((step) => step.id)).toEqual([
      'move',
      'jump',
      'weapons',
      'reflect',
      'dash',
      'shield',
      'wallJump',
      'piercing',
      'interact',
    ]);
  });

  it('unlocks traversal abilities only for their demonstrations', () => {
    expect(tutorialAbilities('weapons')).toEqual({
      phaseDash: false,
      magneticGrip: false,
    });
    expect(tutorialAbilities('dash')).toEqual({ phaseDash: true, magneticGrip: false });
    expect(tutorialAbilities('shield')).toEqual({ phaseDash: true, magneticGrip: false });
    expect(tutorialAbilities('wallJump')).toEqual({ phaseDash: true, magneticGrip: true });
    expect(tutorialAbilities('piercing')).toEqual({ phaseDash: true, magneticGrip: true });
  });

  it('uses formal combat spawns for reflection, shield and piercing lessons', () => {
    expect(tutorialEnemies('reflect')).toEqual([
      { id: 'training-reflect-turret', type: 'turret', x: 370, y: 248 },
    ]);
    expect(tutorialEnemies('shield')[0]).toMatchObject({
      type: 'crawler',
      variant: 'shielded',
    });
    expect(tutorialEnemies('piercing')).toHaveLength(2);
  });
});
