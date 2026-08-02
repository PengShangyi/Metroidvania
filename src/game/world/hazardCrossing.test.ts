import { describe, expect, it } from 'vitest';

import type { AbilityState } from '../state/GameSession';
import { crossingWindow, hazardCrossings } from './hazardCrossing';
import type { Surface } from './reachability';
import { RoomRepository } from './RoomRepository';
import type { RoomDefinition } from './types';

const NO_ABILITY: AbilityState = { phaseDash: false, magneticGrip: false };
const DASH_ONLY: AbilityState = { phaseDash: true, magneticGrip: false };

const rooms = new RoomRepository().all();
const room = (id: string): RoomDefinition =>
  rooms.find((candidate) => candidate.id === id) as RoomDefinition;

/** 一层地面被一道危险区切成两半：左岸、右岸和中间的坑。 */
function banks(gap: number, top = 254): { left: Surface; right: Surface } {
  return {
    left: { id: 'left', top, left: 0, right: 200 },
    right: { id: 'right', top, left: 200 + gap, right: 480 },
  };
}

describe('危险区起跳窗口', () => {
  it('缺口越宽窗口越窄', () => {
    const hazard = (gap: number) => [{ x: 200, y: 246, width: gap, height: 24 }];
    const widths = [24, 40, 56].map((gap) => {
      const { left, right } = banks(gap);
      return crossingWindow(left, right, hazard(gap), NO_ABILITY);
    });
    expect(widths[0]).toBeGreaterThan(widths[1]);
    expect(widths[1]).toBeGreaterThan(widths[2]);
  });

  it('冲刺把徒手跳不过去的缺口变成跳得过去', () => {
    const gap = 72;
    const hazard = [{ x: 200, y: 246, width: gap, height: 24 }];
    const { left, right } = banks(gap);
    expect(crossingWindow(left, right, hazard, NO_ABILITY)).toBe(0);
    expect(crossingWindow(left, right, hazard, DASH_ONLY)).toBeGreaterThan(0);
  });

  it('刺尖高出地面会吃掉窗口：同样的缺口宽度，越高越难跨', () => {
    // 包络模型只看水平间隙，这两种情况在它眼里完全一样。
    const gap = 40;
    const { left, right } = banks(gap);
    const flush = crossingWindow(
      left,
      right,
      [{ x: 200, y: 253, width: gap, height: 17 }],
      NO_ABILITY,
    );
    const tall = crossingWindow(
      left,
      right,
      [{ x: 200, y: 238, width: gap, height: 32 }],
      NO_ABILITY,
    );
    expect(flush).toBeGreaterThan(tall);
  });

  it('封锁堤道的酸池有一条宽松的高台路线，也有一条能走的地面路线', () => {
    const [acid] = hazardCrossings(room('vestibule_causeway'), DASH_ONLY);
    expect(acid.ground?.window).toBeGreaterThanOrEqual(12);
    // 从 p3/p4 高台跳下来比贴地冲过去更宽松，这是这个房间的设计解法。
    expect(acid.best?.window).toBeGreaterThan(acid.ground?.window ?? 0);
  });

  it('淹没晶格与核心回廊没有任何地面横跨路线', () => {
    for (const id of ['bioforge_lattice', 'reactor_coreway']) {
      const [crossing] = hazardCrossings(room(id), { phaseDash: true, magneticGrip: true });
      expect(crossing.ground, id).toBeUndefined();
      expect(crossing.best, id).toBeUndefined();
    }
  });
});
