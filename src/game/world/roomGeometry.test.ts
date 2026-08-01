import { describe, expect, it } from 'vitest';

import type { AbilityState } from '../state/GameSession';
import { buildSurfaces, deriveEnvelope, roomReachability } from './reachability';
import { RoomRepository } from './RoomRepository';
import type { RoomDefinition } from './types';

const rooms = new RoomRepository().all();
const NO_ABILITY: AbilityState = { phaseDash: false, magneticGrip: false };
const DASH_ONLY: AbilityState = { phaseDash: true, magneticGrip: false };
const BOTH: AbilityState = { phaseDash: true, magneticGrip: true };

function unreachable(room: RoomDefinition, abilities: AbilityState): string[] {
  const problems: string[] = [];
  for (const spawn of room.spawns) {
    const reach = roomReachability(room, spawn.id, abilities, 'conservative');
    for (const exit of room.exits) {
      if (!reach.exitReachable(exit)) problems.push(`${room.id}/${spawn.id} 出口 ${exit.id}`);
    }
    for (const pickup of room.pickups) {
      if (!reach.pickupReachable(pickup)) problems.push(`${room.id}/${spawn.id} 拾取 ${pickup.id}`);
    }
    const checkpoint = room.checkpoint;
    if (checkpoint && !reach.checkpointReachable(checkpoint)) {
      problems.push(`${room.id}/${spawn.id} 终端 ${checkpoint.id}`);
    }
    for (const surface of reach.surfaces) {
      if (!reach.standable.some((standable) => standable.id === surface.id)) {
        problems.push(`${room.id}/${spawn.id} 平台 y=${surface.top}`);
      }
    }
  }
  return problems;
}

describe('关卡几何可达性', () => {
  it('拿齐两项能力后，每个房间的每个入口都能走到全部出口、拾取物、终端和平台', () => {
    expect(rooms.flatMap((room) => unreachable(room, BOTH))).toEqual([]);
  });

  it('第一项能力在没有任何能力时就拿得到', () => {
    // 回声库是唯一能拿到相位冲刺的房间：它自己必须是徒手可通的，否则整局无法开始。
    const vault = rooms.find((room) => room.id === 'vestibule_vault');
    expect(vault).toBeDefined();
    const reach = roomReachability(vault!, 'from_shaft', NO_ABILITY, 'conservative');
    const dash = vault!.pickups.find((pickup) => pickup.type === 'phaseDash');
    expect(dash).toBeDefined();
    expect(reach.pickupReachable(dash!)).toBe(true);
  });

  it('第二项能力只靠相位冲刺就拿得到', () => {
    const cradle = rooms.find((room) => room.id === 'bioforge_cradle');
    expect(cradle).toBeDefined();
    const reach = roomReachability(cradle!, 'from_nursery', DASH_ONLY, 'conservative');
    const grip = cradle!.pickups.find((pickup) => pickup.type === 'magneticGrip');
    expect(grip).toBeDefined();
    expect(reach.pickupReachable(grip!)).toBe(true);
  });

  it('Boss 房前一站就有终端，失败重试不用重跑四个房间', () => {
    const threshold = rooms.find((room) => room.id === 'reactor_threshold');
    expect(threshold?.checkpoint).toBeDefined();
    // 顺带确认生化区后半不再是一段没有存档点的长路。
    const cradle = rooms.find((room) => room.id === 'bioforge_cradle');
    expect(cradle?.checkpoint).toBeDefined();
  });

  it('每个存档终端在徒手状态下都够得到', () => {
    const missed = rooms
      .filter((room) => room.checkpoint)
      .filter((room) =>
        room.spawns.every(
          (spawn) =>
            !roomReachability(room, spawn.id, NO_ABILITY, 'conservative').checkpointReachable(
              room.checkpoint!,
            ),
        ),
      )
      .map((room) => room.id);
    expect(missed).toEqual([]);
  });

  it('没有落差卡在跳跃上限的临界带上', () => {
    // 实测跳跃上升 47.5px：48px 的落差只靠 Arcade 4px 的重叠容差才勉强判定为落地，
    // 任何数值微调都会把它变成走不通的死路。要么落在上限之内，要么就明确做成能力门。
    const tight = deriveEnvelope(NO_ABILITY, 'conservative').maxRise;
    const loose = deriveEnvelope(NO_ABILITY, 'generous').maxRise;
    const fragile: string[] = [];
    for (const room of rooms) {
      const surfaces = buildSurfaces(room);
      for (const from of surfaces) {
        for (const to of surfaces) {
          const rise = from.top - to.top;
          if (rise <= tight || rise > loose) continue;
          if (from.left > to.right || to.left > from.right) continue;
          fragile.push(`${room.id} y=${from.top} → y=${to.top}（落差 ${rise}）`);
        }
      }
    }
    expect(fragile).toEqual([]);
  });

  it('通往生化区的堤道要真的冲过去，不是刷卡', () => {
    const causeway = rooms.find((room) => room.id === 'vestibule_causeway');
    expect(causeway).toBeDefined();
    const gate = causeway!.exits.find((exit) => exit.id === 'to_intake');
    expect(gate?.requirement).toBe('phaseDash');
    // 断口 104px，走跳最远 71.5px：徒手连宽松包络都过不去。
    expect(
      roomReachability(causeway!, 'from_shaft', NO_ABILITY, 'generous').exitReachable(gate!),
    ).toBe(false);
    // 但拿到冲刺后必须过得去，否则整个生化区都进不了。
    expect(
      roomReachability(causeway!, 'from_shaft', DASH_ONLY, 'conservative').exitReachable(gate!),
    ).toBe(true);
  });

  it('地形门的数量不会退化', () => {
    // 「能力门」应当是「这里过不去」而不是「这里没刷卡」。这条断言记录当前
    // 真正靠几何拦住玩家的门，改动关卡时不许把它们变回纯门禁。
    const byId = new Map(rooms.map((room) => [room.id, room]));
    const terrainGates: string[] = [];
    for (const room of rooms) {
      for (const exit of room.exits) {
        if (exit.requirement === 'none' || exit.requirement === 'bossDefeated') continue;
        // 冲刺先于磁附获得，所以冲刺门前玩家两手空空，磁附门前只有冲刺。
        const without =
          exit.requirement === 'phaseDash' ? NO_ABILITY : { phaseDash: true, magneticGrip: false };
        const back = new Set(
          (byId.get(exit.targetRoomId)?.exits ?? [])
            .filter((candidate) => candidate.targetRoomId === room.id)
            .map((candidate) => candidate.targetSpawnId),
        );
        const bypassed = room.spawns
          .filter((spawn) => !back.has(spawn.id))
          .some((spawn) =>
            roomReachability(room, spawn.id, without, 'generous').exitReachable(exit),
          );
        if (!bypassed) terrainGates.push(`${room.id}.${exit.id}`);
      }
    }
    expect(terrainGates.sort()).toEqual([
      'reactor_conduit.to_coreway',
      'reactor_coreway.to_threshold',
      'vestibule_causeway.to_intake',
      'vestibule_shaft.to_spire',
    ]);
  });

  it('中央井的竖井是货真价实的地形门，不是一张门禁卡', () => {
    // to_spire 标着 magneticGrip；如果几何上徒手也爬得上去，这个门就退化成纯门禁。
    const shaft = rooms.find((room) => room.id === 'vestibule_shaft');
    expect(shaft).toBeDefined();
    const gate = shaft!.exits.find((exit) => exit.id === 'to_spire');
    expect(gate?.requirement).toBe('magneticGrip');
    const barehanded = roomReachability(shaft!, 'from_gallery', DASH_ONLY, 'generous');
    expect(barehanded.exitReachable(gate!)).toBe(false);
    const gripped = roomReachability(shaft!, 'from_gallery', BOTH, 'conservative');
    expect(gripped.exitReachable(gate!)).toBe(true);
  });
});
