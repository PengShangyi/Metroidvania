import { describe, expect, it } from 'vitest';

import { canStartDash, DASH, dashRefreshAllowed, dashVelocity } from './dashMath';

describe('phase dash rules', () => {
  it('requires the permanent ability and an available charge', () => {
    expect(canStartDash(false, true, true)).toBe(false);
    expect(canStartDash(true, false, true)).toBe(false);
    expect(canStartDash(true, true, false)).toBe(false);
    expect(canStartDash(true, true, true)).toBe(true);
  });

  it('uses facing when input direction is neutral', () => {
    expect(dashVelocity(0)).toBe(DASH.speed);
    expect(dashVelocity(-1)).toBe(-DASH.speed);
  });

  it('无敌至少覆盖整段冲刺', () => {
    // 「相位」冲刺的最后一段如果会掉血，第六课「冲刺穿过盾兵」就自相矛盾。
    expect(DASH.invulnerabilityMs).toBeGreaterThanOrEqual(DASH.durationMs);
  });

  it('冷却比冲刺本身长，杜绝贴地无限连冲', () => {
    expect(DASH.cooldownMs).toBeGreaterThan(DASH.durationMs);
  });

  it('冷却期内即使落地也不恢复冲刺', () => {
    const startedAt = 1_000;
    const readyAt = startedAt + DASH.cooldownMs;
    expect(dashRefreshAllowed(startedAt + DASH.durationMs, readyAt, true)).toBe(false);
    expect(dashRefreshAllowed(readyAt - 1, readyAt, true)).toBe(false);
    expect(dashRefreshAllowed(readyAt, readyAt, true)).toBe(true);
  });

  it('腾空时永远不恢复冲刺', () => {
    expect(dashRefreshAllowed(9_999, 0, false)).toBe(false);
  });
});
