import { describe, expect, it } from 'vitest';

import { MOVEMENT } from '../player/movementMath';
import { WALL_JUMP } from '../player/wallJumpMath';
import { buildSurfaces, deriveEnvelope, jumpRise, roomReachability } from './reachability';
import type { RoomDefinition } from './types';

const NO_ABILITY = { phaseDash: false, magneticGrip: false };
const DASH_ONLY = { phaseDash: true, magneticGrip: false };
const GRIP_ONLY = { phaseDash: false, magneticGrip: true };

function room(overrides: Partial<RoomDefinition>): RoomDefinition {
  return {
    id: 'fixture',
    name: '测试间',
    biome: 'vestibule',
    width: 480,
    height: 270,
    spawns: [{ id: 'start', x: 40, y: 238 }],
    platforms: [{ x: 0, y: 254, width: 480, height: 16 }],
    hazards: [],
    exits: [],
    enemies: [],
    pickups: [],
    ...overrides,
  };
}

describe('运动包络', () => {
  it('按半隐式 Euler 算出 47.5px 的跳跃上升，而不是解析式的 50px', () => {
    expect(jumpRise(MOVEMENT.jumpVelocity)).toBeCloseTo(47.5, 5);
    expect(jumpRise(MOVEMENT.jumpVelocity)).toBeLessThan(
      MOVEMENT.jumpVelocity ** 2 / (2 * MOVEMENT.gravity),
    );
  });

  it('墙跳上升比普通跳略低', () => {
    const wallRise = jumpRise(WALL_JUMP.verticalVelocity);
    expect(wallRise).toBeCloseTo(44.33, 1);
    expect(wallRise).toBeLessThan(jumpRise(MOVEMENT.jumpVelocity));
  });

  it('保守包络收紧、宽松包络放宽同一个上升上限', () => {
    const tight = deriveEnvelope(NO_ABILITY, 'conservative');
    const loose = deriveEnvelope(NO_ABILITY, 'generous');
    expect(tight.maxRise).toBeLessThan(loose.maxRise);
    expect(tight.maxRise).toBeLessThan(48);
    expect(loose.maxRise).toBeGreaterThan(48);
  });

  it('超过上升上限的高度差直接判为不可达', () => {
    const envelope = deriveEnvelope(NO_ABILITY, 'conservative');
    expect(envelope.maxRun(44)).toBeGreaterThan(0);
    expect(envelope.maxRun(52)).toBe(-1);
  });

  it('冲刺显著拉长水平位移', () => {
    const walking = deriveEnvelope(NO_ABILITY, 'conservative');
    const dashing = deriveEnvelope(DASH_ONLY, 'conservative');
    expect(dashing.maxRun(0)).toBeGreaterThan(walking.maxRun(0) + 30);
  });

  it('高度差越大水平余量越小', () => {
    const envelope = deriveEnvelope(NO_ABILITY, 'conservative');
    expect(envelope.maxRun(40)).toBeLessThan(envelope.maxRun(0));
  });
});

describe('平面切分', () => {
  it('把危险区覆盖的落脚区间挖掉', () => {
    const surfaces = buildSurfaces(
      room({
        platforms: [{ x: 0, y: 254, width: 480, height: 16 }],
        hazards: [{ x: 200, y: 246, width: 80, height: 24 }],
      }),
    );
    expect(surfaces).toHaveLength(2);
    expect(surfaces[0]?.right).toBeLessThan(200);
    expect(surfaces[1]?.left).toBeGreaterThan(280);
  });

  it('危险区不挨着落脚面时不切分', () => {
    const surfaces = buildSurfaces(room({ hazards: [{ x: 200, y: 100, width: 80, height: 20 }] }));
    expect(surfaces).toHaveLength(1);
  });
});

describe('房间可达性', () => {
  it('48px 的落差在保守包络下判为走不通', () => {
    const result = roomReachability(
      room({
        platforms: [
          { x: 0, y: 254, width: 480, height: 16 },
          { x: 100, y: 206, width: 80, height: 12 },
        ],
      }),
      'start',
      NO_ABILITY,
    );
    expect(result.standable).toHaveLength(1);
  });

  it('44px 的落差走得通', () => {
    const result = roomReachability(
      room({
        platforms: [
          { x: 0, y: 254, width: 480, height: 16 },
          { x: 100, y: 210, width: 80, height: 12 },
        ],
      }),
      'start',
      NO_ABILITY,
    );
    expect(result.standable).toHaveLength(2);
  });

  it('沟壑宽到普通跳跃过不去、冲刺才过得去', () => {
    const gapRoom = room({
      platforms: [
        { x: 0, y: 254, width: 160, height: 16 },
        { x: 256, y: 254, width: 224, height: 16 },
      ],
      hazards: [{ x: 160, y: 246, width: 96, height: 24 }],
    });
    expect(roomReachability(gapRoom, 'start', NO_ABILITY, 'generous').standable).toHaveLength(1);
    expect(roomReachability(gapRoom, 'start', DASH_ONLY, 'conservative').standable).toHaveLength(2);
  });

  it('磁附跃迁能沿高墙攀爬到普通跳跃够不到的顶面', () => {
    const towerRoom = room({
      platforms: [
        { x: 0, y: 254, width: 480, height: 16 },
        { x: 200, y: 150, width: 16, height: 104 },
      ],
    });
    expect(roomReachability(towerRoom, 'start', NO_ABILITY).standable).toHaveLength(1);
    expect(roomReachability(towerRoom, 'start', GRIP_ONLY).standable).toHaveLength(2);
  });

  it('出口判定用站立时的探针高度，半空中的门算不可达', () => {
    const grounded = room({
      exits: [
        {
          id: 'ok',
          x: 438,
          y: 210,
          width: 24,
          height: 44,
          targetRoomId: 'other',
          targetSpawnId: 'in',
          requirement: 'none',
        },
      ],
    });
    expect(roomReachability(grounded, 'start', NO_ABILITY).exitReachable(grounded.exits[0]!)).toBe(
      true,
    );

    const midair = room({
      exits: [
        {
          id: 'floating',
          x: 438,
          y: 62,
          width: 24,
          height: 44,
          targetRoomId: 'other',
          targetSpawnId: 'in',
          requirement: 'none',
        },
      ],
    });
    expect(roomReachability(midair, 'start', NO_ABILITY).exitReachable(midair.exits[0]!)).toBe(
      false,
    );
  });

  it('够不到的拾取物判为不可达', () => {
    const withPickup = room({
      pickups: [
        { id: 'far', type: 'healthCell', x: 240, y: 60, requirement: 'none' },
        { id: 'near', type: 'healthCell', x: 240, y: 244, requirement: 'none' },
      ],
    });
    const result = roomReachability(withPickup, 'start', NO_ABILITY);
    expect(result.pickupReachable(withPickup.pickups[0]!)).toBe(false);
    expect(result.pickupReachable(withPickup.pickups[1]!)).toBe(true);
  });
});
