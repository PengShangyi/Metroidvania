import { describe, expect, it } from 'vitest';

import { shouldTurnAround, sporeLeapVelocity, TURRET_SIGHT, turretCanFire } from './aiMath';

describe('spore leaper', () => {
  it('leaps toward the player and caps horizontal speed', () => {
    expect(sporeLeapVelocity(200, 100)).toEqual({ x: 64, y: -218 });
    expect(sporeLeapVelocity(-500, 100)).toEqual({ x: -82, y: -218 });
  });
});

describe('爬行体折返', () => {
  it('撞墙时折返', () => {
    expect(shouldTurnAround(true, true)).toBe(true);
  });

  it('前方没有落脚点时也折返，不再径直走下平台', () => {
    expect(shouldTurnAround(false, false)).toBe(true);
  });

  it('前方有路且没撞墙就继续走', () => {
    expect(shouldTurnAround(false, true)).toBe(false);
  });
});

describe('炮台索敌', () => {
  it('射程内的玩家会被瞄准', () => {
    expect(turretCanFire(100, 200, 180, 220)).toBe(true);
  });

  it('隔着大半个房间不再打冷枪', () => {
    expect(turretCanFire(100, 200, 100 + TURRET_SIGHT.range + 1, 200)).toBe(false);
  });

  it('高度差过大也不开火', () => {
    expect(turretCanFire(100, 200, 120, 200 - TURRET_SIGHT.verticalReach - 1)).toBe(false);
  });
});
