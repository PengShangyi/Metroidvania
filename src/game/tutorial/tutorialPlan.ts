import type { AbilityState } from '../state/GameSession';

export type TutorialStepId = 'move' | 'jump' | 'weapons' | 'dash' | 'wallJump' | 'interact';

export interface TutorialStep {
  id: TutorialStepId;
  title: string;
  objective: string;
  effect: string;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'move',
    title: '移动与观察',
    objective: 'A / D、方向键或左摇杆：向右抵达青色信标',
    effect: '移动会平滑加速；松开方向后快速制动。',
  },
  {
    id: 'jump',
    title: '可变高度跳跃',
    objective: 'SPACE / A：跳上训练台；短按低跳，按住跳得更高',
    effect: '离开边缘后 100ms 仍可起跳，提前 120ms 按键也会在落地时触发。',
  },
  {
    id: 'weapons',
    title: '基础战斗',
    objective: 'J / X 击中菱形靶；K / Y 击中三角靶',
    effect: '能量枪射程远且无弹药；能量刃伤害更高，适合近身。',
  },
  {
    id: 'dash',
    title: '相位冲刺',
    objective: 'SHIFT / B：向右冲过青色相位门',
    effect: '冲刺持续 150ms，前 120ms 可免疫伤害；空中次数落地恢复。',
  },
  {
    id: 'wallJump',
    title: '磁附跃迁',
    objective: '贴住右侧墙面，再按 SPACE / A 完成墙跳',
    effect: '贴墙下落限速为 55px/s；墙跳会向反方向弹出。',
  },
  {
    id: 'interact',
    title: '终端与交互',
    objective: '靠近终端，按 E / RB 完成训练',
    effect: '正式任务中，终端会保存复活点并完全恢复生命。',
  },
] as const;

export function tutorialAbilities(step: TutorialStepId): AbilityState {
  return {
    phaseDash: step === 'dash' || step === 'wallJump' || step === 'interact',
    magneticGrip: step === 'wallJump' || step === 'interact',
  };
}
