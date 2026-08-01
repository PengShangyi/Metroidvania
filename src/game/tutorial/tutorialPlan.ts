import type { AbilityState } from '../state/GameSession';
import type { EnemySpawn } from '../world/types';

export type TutorialStepId =
  | 'move'
  | 'jump'
  | 'weapons'
  | 'reflect'
  | 'dash'
  | 'shield'
  | 'wallJump'
  | 'piercing'
  | 'interact';

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
    objective: '向右抵达青色信标',
    effect: '移动会平滑加速；松开方向后快速制动。',
  },
  {
    id: 'jump',
    title: '可变高度跳跃',
    objective: '跳上训练台；短按低跳，按住跳得更高',
    effect: '离开边缘后 100ms 仍可起跳，提前 120ms 按键也会在落地时触发。',
  },
  {
    id: 'weapons',
    title: '基础战斗',
    objective: '击中菱形射击靶与三角近战靶',
    effect: '能量枪射程远且无弹药；能量刃伤害更高，适合近身。',
  },
  {
    id: 'reflect',
    title: '短窗反射',
    objective: '在炮弹接近刀刃时挥砍，将它反射',
    effect: '挥砍前 80ms 可反射炮台弹；反射弹造成 2 点伤害。',
  },
  {
    id: 'dash',
    title: '相位冲刺',
    objective: '向右冲过青色相位门',
    effect: '冲刺持续 150ms，全程免疫伤害；落地并等冷却走完后才会恢复。',
  },
  {
    id: 'shield',
    title: '穿盾开核',
    objective: '冲刺越过盾兵中心，再从抵达侧攻击核心',
    effect: '核心暴露 1.8 秒；冲刺只开盾，不会直接造成伤害。',
  },
  {
    id: 'wallJump',
    title: '磁附跃迁',
    objective: '贴住右侧墙面并完成墙跳',
    effect: '贴墙下落限速为 55px/s；墙跳会向反方向弹出。',
  },
  {
    id: 'piercing',
    title: '墙跳贯穿',
    objective: '墙跳后立刻射击，让同一发子弹命中两个目标',
    effect: '每次墙跳只武装首发；琥珀轮廓亮起时可发射贯穿弹。',
  },
  {
    id: 'interact',
    title: '终端与交互',
    objective: '靠近终端并完成训练',
    effect: '正式任务中，终端会保存复活点并完全恢复生命。',
  },
] as const;

const TUTORIAL_ENEMIES: Partial<Record<TutorialStepId, readonly EnemySpawn[]>> = {
  reflect: [{ id: 'training-reflect-turret', type: 'turret', x: 370, y: 248 }],
  shield: [{ id: 'training-shield-crawler', type: 'crawler', variant: 'shielded', x: 264, y: 248 }],
  piercing: [
    { id: 'training-piercing-a', type: 'sentry', x: 238, y: 168 },
    { id: 'training-piercing-b', type: 'sentry', x: 304, y: 168 },
  ],
};

export function tutorialAbilities(step: TutorialStepId): AbilityState {
  return {
    phaseDash:
      step === 'dash' ||
      step === 'shield' ||
      step === 'wallJump' ||
      step === 'piercing' ||
      step === 'interact',
    magneticGrip: step === 'wallJump' || step === 'piercing' || step === 'interact',
  };
}

export function tutorialEnemies(step: TutorialStepId): EnemySpawn[] {
  return (TUTORIAL_ENEMIES[step] ?? []).map((spawn) => ({ ...spawn }));
}
