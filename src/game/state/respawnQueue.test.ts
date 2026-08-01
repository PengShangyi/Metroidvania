import { describe, expect, it } from 'vitest';

import { respawnDecision } from './respawnQueue';

describe('respawn scheduling', () => {
  it('starts a respawn from normal play', () => {
    expect(respawnDecision(false, false)).toBe('start');
  });

  it('queues a death that lands in the tail of a room transition', () => {
    // 回归：切换房间的最后 140ms 里玩家实体已经恢复，物理重叠回调可以致死，
    // 旧实现直接 return，玩家会留在 0 血继续游戏。
    expect(respawnDecision(false, true)).toBe('queue');
  });

  it('ignores re-entry while a respawn is already playing out', () => {
    expect(respawnDecision(true, true)).toBe('ignore');
    expect(respawnDecision(true, false)).toBe('ignore');
  });
});
