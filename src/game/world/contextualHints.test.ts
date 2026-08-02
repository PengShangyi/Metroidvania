import { describe, expect, it } from 'vitest';

import {
  CONTEXT_HINT_DURATION_MS,
  ContextualHintTracker,
  contextualHints,
} from './contextualHints';

describe('房间上下文提示', () => {
  it('三个首次使用的房间各有一条战斗融合提示', () => {
    expect(contextualHints('vestibule_depot').map((hint) => hint.id)).toEqual(['reflect']);
    expect(contextualHints('vestibule_causeway').map((hint) => hint.id)).toContain('shield');
    expect(contextualHints('bioforge_spire').map((hint) => hint.id)).toEqual(['piercing']);
    expect(contextualHints('core_guardian')).toEqual([]);
    expect(CONTEXT_HINT_DURATION_MS).toBe(2_200);
  });

  it('封锁堤道先讲怎么过酸池，再讲怎么打盾兵', () => {
    // 过不去酸池就见不到盾兵，顺序反了等于这条提示白给。
    const hints = contextualHints('vestibule_causeway');
    expect(hints.map((hint) => hint.kind)).toEqual(['traversal', 'combat']);
    expect(hints[0]?.message).toContain('高台');
  });

  it('去重只发生在当前这一局的 tracker 里', () => {
    const hint = contextualHints('vestibule_depot')[0];
    if (!hint) throw new Error('测试提示缺失');
    const tracker = new ContextualHintTracker();
    expect(tracker.hasShown(hint)).toBe(false);
    tracker.markShown(hint);
    expect(tracker.hasShown(hint)).toBe(true);
    expect(new ContextualHintTracker().hasShown(hint)).toBe(false);
  });
});
