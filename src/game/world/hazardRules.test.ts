import { describe, expect, it } from 'vitest';

import { intersectsAnyHazard, type AABB } from './hazardRules';

/** 玩家精灵 24×32，原点 (0.5, 1)。 */
function displayBox(x: number, y: number): AABB {
  return { x: x - 12, y: y - 32, width: 24, height: 32 };
}

/** 玩家碰撞体 14×28，offset (5, 4)。 */
function bodyBox(x: number, y: number): AABB {
  return { x: x - 7, y: y - 28, width: 14, height: 28 };
}

describe('hazard overlap', () => {
  it('ignores the sprite margin that the display box would report as a hit', () => {
    // 回归：站在危险区左侧 1px 外时，精灵矩形已经压到危险区上，碰撞体还没有。
    const hazard: AABB = { x: 198, y: 240, width: 24, height: 10 };

    expect(intersectsAnyHazard(displayBox(190, 250), [hazard])).toBe(true);
    expect(intersectsAnyHazard(bodyBox(190, 250), [hazard])).toBe(false);
  });

  it('still reports a real overlap', () => {
    const hazard: AABB = { x: 198, y: 240, width: 24, height: 10 };
    expect(intersectsAnyHazard(bodyBox(206, 250), [hazard])).toBe(true);
  });

  it('treats touching edges as contact, matching the previous geometry helper', () => {
    const hazard: AABB = { x: 100, y: 100, width: 10, height: 10 };
    expect(intersectsAnyHazard({ x: 90, y: 100, width: 10, height: 10 }, [hazard])).toBe(true);
    expect(intersectsAnyHazard({ x: 89, y: 100, width: 10, height: 10 }, [hazard])).toBe(false);
  });

  it('scans every hazard in the room', () => {
    const hazards: AABB[] = [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 200, y: 240, width: 24, height: 10 },
    ];
    expect(intersectsAnyHazard(bodyBox(206, 250), hazards)).toBe(true);
    expect(intersectsAnyHazard(bodyBox(400, 250), hazards)).toBe(false);
    expect(intersectsAnyHazard(bodyBox(206, 250), [])).toBe(false);
  });
});
