import { describe, expect, it } from 'vitest';

import {
  initialTutorialHudState,
  tutorialHudState,
  withComplete,
  withEffect,
} from './tutorialHudState';
import { TUTORIAL_STEPS } from './tutorialPlan';

describe('训练 HUD 状态', () => {
  it('把步骤序号按 1 起算，并带上当前设备的按键提示', () => {
    const state = tutorialHudState(0, 'keyboardMouse');

    expect(state.step).toBe(1);
    expect(state.stepCount).toBe(TUTORIAL_STEPS.length);
    expect(state.title).toBe(TUTORIAL_STEPS[0]!.title);
    expect(state.objective).toBe(`A / D 或方向键：${TUTORIAL_STEPS[0]!.objective}`);
    expect(state.effect).toBe(TUTORIAL_STEPS[0]!.effect);
    expect(state.complete).toBe(false);
  });

  it('切换到手柄时只有按键提示改变', () => {
    const keyboard = tutorialHudState(4, 'keyboardMouse');
    const gamepad = tutorialHudState(4, 'gamepad');

    expect(gamepad.title).toBe(keyboard.title);
    expect(gamepad.objective).toBe(`B：${TUTORIAL_STEPS[4]!.objective}`);
    expect(gamepad.objective).not.toBe(keyboard.objective);
  });

  it('每一课都能产出非空的标题、目标与效果', () => {
    for (let index = 0; index < TUTORIAL_STEPS.length; index += 1) {
      const state = tutorialHudState(index, 'gamepad');
      expect(state.title.length).toBeGreaterThan(0);
      expect(state.objective).toContain('：');
      expect(state.effect.length).toBeGreaterThan(0);
    }
  });

  it('越界的步骤退回初始状态而不是抛错', () => {
    expect(tutorialHudState(TUTORIAL_STEPS.length, 'keyboardMouse')).toEqual(
      initialTutorialHudState(),
    );
  });

  it('withEffect 与 withComplete 不改动其他字段', () => {
    const base = tutorialHudState(2, 'keyboardMouse');

    expect(withEffect(base, '训练体已耗尽 · 正在重构')).toEqual({
      ...base,
      effect: '训练体已耗尽 · 正在重构',
    });
    expect(withComplete(base)).toEqual({ ...base, complete: true });
    expect(base.complete).toBe(false);
  });
});
