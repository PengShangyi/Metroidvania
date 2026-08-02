import { describe, expect, it } from 'vitest';

import { createNewSession } from '../state/GameSession';
import { RoomRepository } from '../world/RoomRepository';
import { buildAdjacency, connectionVisible, roomVisibility, visibleMarkers } from './mapVisibility';

const rooms = new RoomRepository().all();
const adjacency = buildAdjacency(rooms);

describe('地图战争迷雾', () => {
  it('邻接表是双向的', () => {
    expect(adjacency.get('vestibule_dock')).toContain('vestibule_gallery');
    expect(adjacency.get('vestibule_gallery')).toContain('vestibule_dock');
  });

  it('开局只暴露出生房和它的邻居', () => {
    const visited = new Set(['vestibule_dock']);
    expect(roomVisibility('vestibule_dock', visited, adjacency)).toBe('visited');
    expect(roomVisibility('vestibule_gallery', visited, adjacency)).toBe('adjacent');
    expect(roomVisibility('core_guardian', visited, adjacency)).toBe('hidden');
  });

  it('未探索的房间数量随探索推进而下降', () => {
    const hiddenAt = (visited: string[]): number =>
      rooms.filter((room) => roomVisibility(room.id, new Set(visited), adjacency) === 'hidden')
        .length;
    expect(hiddenAt(['vestibule_dock'])).toBeGreaterThan(
      hiddenAt(['vestibule_dock', 'vestibule_gallery', 'vestibule_shaft']),
    );
  });

  it('全部走遍后没有任何房间是隐藏的', () => {
    const visited = new Set(rooms.map((room) => room.id));
    expect(rooms.every((room) => roomVisibility(room.id, visited, adjacency) === 'visited')).toBe(
      true,
    );
  });

  it('只要一端走过就画出连线', () => {
    const visited = new Set(['vestibule_dock']);
    expect(connectionVisible('vestibule_dock', 'vestibule_gallery', visited)).toBe(true);
    expect(connectionVisible('bioforge_pump', 'bioforge_lattice', visited)).toBe(false);
  });
});

describe('地图标注', () => {
  it('除了能力模块，没走过的房间不标注', () => {
    const session = createNewSession();
    session.visitedRooms = new Set(['vestibule_dock']);
    const strays = visibleMarkers(rooms, session).filter(
      (marker) => marker.roomId !== 'vestibule_dock' && marker.kind !== 'ability',
    );
    expect(strays).toEqual([]);
  });

  it('标出终端、未拾取的道具与能力门', () => {
    const session = createNewSession();
    session.visitedRooms = new Set(['vestibule_dock', 'vestibule_depot', 'vestibule_shaft']);
    const kinds = (roomId: string): string[] =>
      visibleMarkers(rooms, session)
        .filter((marker) => marker.roomId === roomId)
        .map((marker) => marker.kind);
    expect(kinds('vestibule_dock')).toContain('terminal');
    expect(kinds('vestibule_depot')).toContain('pickup');
    expect(kinds('vestibule_shaft')).toContain('gate');
  });

  it('拾走之后就不再标注道具', () => {
    const session = createNewSession();
    session.visitedRooms = new Set(['vestibule_depot']);
    expect(visibleMarkers(rooms, session).some((marker) => marker.kind === 'pickup')).toBe(true);
    for (const pickup of rooms.find((room) => room.id === 'vestibule_depot')!.pickups) {
      session.collectedPickups.add(pickup.id);
    }
    expect(visibleMarkers(rooms, session).some((marker) => marker.kind === 'pickup')).toBe(false);
  });

  it('两个能力模块从一开始就标出来，拿到之后消失', () => {
    // 有意推翻「不提前剧透」：能力是主线目标不是可选收集品，被能力门挡住的玩家
    // 只会收到「通道需要：相位冲刺」，藏起模块位置只让人不知道往哪走。
    const session = createNewSession();
    session.visitedRooms = new Set(['vestibule_dock']);
    const abilityRooms = (): string[] =>
      visibleMarkers(rooms, session)
        .filter((marker) => marker.kind === 'ability')
        .map((marker) => marker.roomId);
    expect(abilityRooms()).toEqual(['vestibule_vault', 'bioforge_cradle']);

    session.collectedPickups.add('ability-phase-dash');
    expect(abilityRooms()).toEqual(['bioforge_cradle']);
    session.collectedPickups.add('ability-magnetic-grip');
    expect(abilityRooms()).toEqual([]);
  });

  it('能力模块房间不会再多画一个通用道具点', () => {
    const session = createNewSession();
    session.visitedRooms = new Set(['vestibule_vault']);
    const kinds = visibleMarkers(rooms, session)
      .filter((marker) => marker.roomId === 'vestibule_vault')
      .map((marker) => marker.kind);
    expect(kinds).toContain('ability');
    expect(kinds).not.toContain('pickup');
  });
});
