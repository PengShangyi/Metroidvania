export type RespawnDecision = 'start' | 'queue' | 'ignore';

/**
 * 房间切换的最后一段里 `transitioning` 仍为 true，但玩家实体已经恢复，
 * 敌人接触这类物理重叠回调可以致死。这段时间内的死亡必须排队而不是丢弃，
 * 否则玩家会停在 0 血继续游戏，直到下一次挨打才真正重生。
 */
export function respawnDecision(respawning: boolean, transitioning: boolean): RespawnDecision {
  if (respawning) return 'ignore';
  if (transitioning) return 'queue';
  return 'start';
}
