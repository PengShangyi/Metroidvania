import type { PlayerMovementState } from '../player/Player';
import type { TutorialStepId } from './tutorialPlan';

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
