import { describe, expect, it } from 'vitest';

import { HELP_CONTENT, tutorialControlHint } from './helpContent';

describe('adaptive help content', () => {
  it('documents every core action for keyboard/mouse and gamepad', () => {
    for (const device of ['keyboardMouse', 'gamepad'] as const) {
      const actions = HELP_CONTENT[device].flatMap((group) => group.rows.map((row) => row.action));
      expect(actions).toEqual([
        '移动',
        '跳跃',
        '能量枪',
        '能量刃',
        '相位冲刺',
        '交互',
        '地图',
        '暂停',
        '帮助',
        device === 'gamepad' ? '菜单选择' : '全屏',
      ]);
    }
  });

  it('uses device-specific labels in skill lessons', () => {
    expect(tutorialControlHint('dash', 'keyboardMouse')).toBe('SHIFT');
    expect(tutorialControlHint('dash', 'gamepad')).toBe('B');
    expect(tutorialControlHint('wallJump', 'gamepad')).toContain('A');
  });
});
