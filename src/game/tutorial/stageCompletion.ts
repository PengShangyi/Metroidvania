import type { PlayerMovementState } from '../player/Player';
import { tutorialEnemies, type TutorialStepId } from './tutorialPlan';

export interface TutorialStageSnapshot {
  playerX: number;
  playerY: number;
  grounded: boolean;
  movementState: PlayerMovementState;
  /** `updateMovement` 之前采样 */
  wallJumpSerialBefore: number;
  /** `updateMovement` 之后采样 */
  wallJumpSerialAfter: number;
  interactPressed: boolean;
  shootTargetDown: boolean;
  meleeTargetDown: boolean;
}

export const TUTORIAL_GOALS = {
  moveX: 82,
  jumpMinX: 122,
  jumpMaxX: 184,
  jumpMaxY: 212,
  dashX: 312,
  terminalX: 448,
  terminalY: 232,
  terminalRadius: 42,
} as const;

/**
 * 反射、穿盾与贯穿三课由 COMBAT_EVENTS 驱动，这里一律返回 false。
 */
export function tutorialStageComplete(
  step: TutorialStepId,
  snapshot: TutorialStageSnapshot,
): boolean {
  if (step === 'move') return snapshot.playerX >= TUTORIAL_GOALS.moveX;

  if (step === 'jump') {
    return (
      snapshot.grounded &&
      snapshot.playerX >= TUTORIAL_GOALS.jumpMinX &&
      snapshot.playerX <= TUTORIAL_GOALS.jumpMaxX &&
      snapshot.playerY <= TUTORIAL_GOALS.jumpMaxY
    );
  }

  if (step === 'weapons') return snapshot.shootTargetDown && snapshot.meleeTargetDown;

  if (step === 'dash') {
    return snapshot.movementState === 'dash' && snapshot.playerX >= TUTORIAL_GOALS.dashX;
  }

  // 墙跳序号是唯一可信的信号：贴墙站在地面上按跳跃同样满足「贴墙 + 向上速度」，
  // 但 canWallJump 要求离地，那一跳并不是墙跳。
  if (step === 'wallJump') return snapshot.wallJumpSerialAfter !== snapshot.wallJumpSerialBefore;

  if (step === 'interact') {
    if (!snapshot.interactPressed) return false;
    const distance = Math.hypot(
      snapshot.playerX - TUTORIAL_GOALS.terminalX,
      snapshot.playerY - TUTORIAL_GOALS.terminalY,
    );
    return distance < TUTORIAL_GOALS.terminalRadius;
  }

  return false;
}

/**
 * 反射课和贯穿课要靠训练体持续供靶，但训练体只有 3 点生命、可以被打死，
 * 而这两课的完成信号来自 COMBAT_EVENTS，靶子没了就再也触发不了。
 * resetStage 只挂在玩家死亡上，敌人死光之后玩家反而不会再受伤——
 * 结果是只能按 ESC 退回标题。这里判定「该重新投放训练体了」。
 *
 * 穿盾课不算：打死那只爬行体本身就会先触发 shieldCoreHit 过关。
 *
 * 判据是「少了一只就补」而不是「死光才补」：贯穿课要同一发弹体串起两个靶子，打死其中
 * 一只之后剩下的那只再怎么打也凑不齐 2/2，而 sentry 只有 3 点生命、能量刃两下就误杀。
 * 等 aliveCount 归零的话，玩家会卡在一个既过不了关、又不给任何提示的房间里。
 */
export function trainingEnemiesExhausted(step: TutorialStepId, aliveCount: number): boolean {
  if (step !== 'reflect' && step !== 'piercing') return false;
  const total = tutorialEnemies(step).length;
  return total > 0 && aliveCount < total;
}
