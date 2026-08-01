import type { GateRequirement } from './types';

const EXIT_MESSAGES: Record<GateRequirement, string> = {
  none: '',
  phaseDash: '通道需要：相位冲刺',
  magneticGrip: '通道需要：磁附跃迁',
  dualAbility: '最终锁需要：两项跃迁能力',
  bossDefeated: '核心仍处于封锁状态',
};

const PICKUP_MESSAGES: Record<GateRequirement, string> = {
  none: '',
  phaseDash: '固定架已锁死 · 需要相位冲刺',
  magneticGrip: '固定架已锁死 · 需要磁附跃迁',
  dualAbility: '固定架已锁死 · 需要两项跃迁能力',
  bossDefeated: '固定架已锁死 · 核心离线后才能取出',
};

export function exitRequirementMessage(requirement: GateRequirement): string {
  return EXIT_MESSAGES[requirement];
}

/** 被能力门挡住的拾取物同样需要解释，否则玩家只会看到一个走进去毫无反应的物件。 */
export function pickupRequirementMessage(requirement: GateRequirement): string {
  return PICKUP_MESSAGES[requirement];
}
