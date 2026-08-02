import { describe, expect, it } from 'vitest';

import {
  trainingEnemiesExhausted,
  tutorialStageComplete,
  type TutorialStageSnapshot,
} from './stageCompletion';
import type { TutorialStepId } from './tutorialPlan';

function complete(step: TutorialStepId, overrides: Partial<TutorialStageSnapshot> = {}): boolean {
  return tutorialStageComplete(step, {
    playerX: 0,
    playerY: 248,
    grounded: true,
    movementState: 'idle',
    wallJumpSerialBefore: 4,
    wallJumpSerialAfter: 4,
    interactPressed: false,
    shootTargetDown: false,
    meleeTargetDown: false,
    ...overrides,
  });
}

describe('tutorial stage completion', () => {
  it('only clears the wall jump lesson when a wall jump actually happened', () => {
    expect(complete('wallJump', { wallJumpSerialAfter: 5 })).toBe(true);
  });

  it('rejects a plain ground jump taken while pressed against the wall', () => {
    // 回归：贴墙站在地面上按跳跃时 blocked.right 为真、velocity.y 为负，
    // 但 canWallJump 要求离地，所以这一跳并不是墙跳。
    const groundJump = { grounded: true, movementState: 'jump', playerX: 390 } as const;

    expect(complete('wallJump', groundJump)).toBe(false);
  });

  it('rejects a mid-air jump that never touched a wall', () => {
    expect(complete('wallJump', { grounded: false, movementState: 'fall' })).toBe(false);
  });

  it('clears the movement lesson at the beacon', () => {
    expect(complete('move', { playerX: 82 })).toBe(true);
    expect(complete('move', { playerX: 81 })).toBe(false);
  });

  it('requires a landing on the training platform for the jump lesson', () => {
    expect(complete('jump', { playerX: 154, playerY: 210 })).toBe(true);
    expect(complete('jump', { playerX: 154, playerY: 210, grounded: false })).toBe(false);
    expect(complete('jump', { playerX: 200, playerY: 210 })).toBe(false);
    expect(complete('jump', { playerX: 154, playerY: 240 })).toBe(false);
  });

  it('requires both weapon targets before advancing', () => {
    expect(complete('weapons', { shootTargetDown: true, meleeTargetDown: true })).toBe(true);
    expect(complete('weapons', { shootTargetDown: true })).toBe(false);
    expect(complete('weapons', { meleeTargetDown: true })).toBe(false);
  });

  it('requires an active dash through the phase gate', () => {
    expect(complete('dash', { movementState: 'dash', playerX: 312 })).toBe(true);
    expect(complete('dash', { movementState: 'dash', playerX: 300 })).toBe(false);
    expect(complete('dash', { movementState: 'run', playerX: 400 })).toBe(false);
  });

  it('requires both proximity and the interact press to finish the run', () => {
    expect(complete('interact', { playerX: 448, interactPressed: true })).toBe(true);
    expect(complete('interact', { playerX: 448 })).toBe(false);
    expect(complete('interact', { playerX: 300, interactPressed: true })).toBe(false);
  });

  it('leaves the combat lessons to their combat events', () => {
    for (const step of ['reflect', 'shield', 'piercing'] as const) {
      expect(complete(step, { wallJumpSerialAfter: 99, interactPressed: true })).toBe(false);
    }
  });
});

describe('训练体耗尽判定', () => {
  it('反射课与贯穿课的靶子被打光时要求重新投放', () => {
    expect(trainingEnemiesExhausted('reflect', 0)).toBe(true);
    expect(trainingEnemiesExhausted('piercing', 0)).toBe(true);
  });

  it('靶子齐全时不重投', () => {
    expect(trainingEnemiesExhausted('reflect', 1)).toBe(false);
    expect(trainingEnemiesExhausted('piercing', 2)).toBe(false);
  });

  it('贯穿课少一只靶子就要重投——剩下一只永远凑不齐 2/2', () => {
    // 这个中间值此前没被测到：判据写成 aliveCount === 0 时它返回 false，
    // 玩家误杀一只 sentry 之后就卡在一个既过不了关、也不给提示的房间里。
    expect(trainingEnemiesExhausted('piercing', 1)).toBe(true);
  });

  it('穿盾课不参与：打死那只爬行体本身就会先过关', () => {
    expect(trainingEnemiesExhausted('shield', 0)).toBe(false);
  });

  it('本来就不投放敌人的课不受影响', () => {
    for (const step of ['move', 'jump', 'weapons', 'dash', 'wallJump', 'interact'] as const) {
      expect(trainingEnemiesExhausted(step, 0)).toBe(false);
    }
  });
});
