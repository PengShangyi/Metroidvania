import { describe, expect, it } from 'vitest';

import {
  CONTEXT_HINT_DURATION_MS,
  ContextualCombatHintTracker,
  contextualCombatHint,
} from './contextualCombatHints';

describe('contextual combat hints', () => {
  it('maps the three first-use rooms to concise combat-fusion hints', () => {
    expect(contextualCombatHint('vestibule_depot')?.id).toBe('reflect');
    expect(contextualCombatHint('vestibule_causeway')?.id).toBe('shield');
    expect(contextualCombatHint('bioforge_spire')?.id).toBe('piercing');
    expect(contextualCombatHint('core_guardian')).toBeUndefined();
    expect(CONTEXT_HINT_DURATION_MS).toBe(2_200);
  });

  it('deduplicates only in the current in-memory tracker', () => {
    const hint = contextualCombatHint('vestibule_depot');
    if (!hint) throw new Error('测试提示缺失');
    const tracker = new ContextualCombatHintTracker();
    expect(tracker.hasShown(hint)).toBe(false);
    tracker.markShown(hint);
    expect(tracker.hasShown(hint)).toBe(true);
    expect(new ContextualCombatHintTracker().hasShown(hint)).toBe(false);
  });
});
