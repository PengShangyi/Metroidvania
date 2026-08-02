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
        '磁附跃迁',
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

  it('documents all three combat-fusion techniques for both devices', () => {
    for (const device of ['keyboardMouse', 'gamepad'] as const) {
      const combatRows = HELP_CONTENT[device][0]?.rows ?? [];
      expect(combatRows.find((row) => row.action === '能量枪')?.description).toContain('贯穿');
      expect(combatRows.find((row) => row.action === '能量刃')?.description).toContain('80ms');
      expect(combatRows.find((row) => row.action === '相位冲刺')?.description).toContain(
        '穿盾开核',
      );
    }
  });

  it('两项能力都要写出地形用途，不能只写战斗用途', () => {
    // 玩家卡在酸池和竖井前的直接原因：帮助面板把冲刺写成纯战斗技能，
    // 磁附跃迁干脆一行都没有，于是没人知道它们也是解地形的钥匙。
    for (const device of ['keyboardMouse', 'gamepad'] as const) {
      const rows = HELP_CONTENT[device][0]?.rows ?? [];
      expect(rows.find((row) => row.action === '相位冲刺')?.description).toContain('酸池');
      expect(rows.find((row) => row.action === '磁附跃迁')?.description).toContain('墙');
    }
  });
});
