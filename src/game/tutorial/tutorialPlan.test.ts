import { describe, expect, it } from 'vitest';

import { TUTORIAL_STEPS, tutorialAbilities } from './tutorialPlan';

describe('tutorial plan', () => {
  it('covers movement, combat, both abilities and interaction in order', () => {
    expect(TUTORIAL_STEPS.map((step) => step.id)).toEqual([
      'move',
      'jump',
      'weapons',
      'dash',
      'wallJump',
      'interact',
    ]);
  });

  it('unlocks traversal abilities only for their demonstrations', () => {
    expect(tutorialAbilities('weapons')).toEqual({
      phaseDash: false,
      magneticGrip: false,
    });
    expect(tutorialAbilities('dash')).toEqual({ phaseDash: true, magneticGrip: false });
    expect(tutorialAbilities('wallJump')).toEqual({ phaseDash: true, magneticGrip: true });
  });
});
