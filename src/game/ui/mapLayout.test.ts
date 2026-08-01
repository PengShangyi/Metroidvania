import { describe, expect, it } from 'vitest';

import rawRooms from '../world/rooms.json';
import { ROOM_MAP_LAYOUT, type MapPoint } from './mapLayout';

describe('exploration map layout', () => {
  it('places every room exactly once inside the logical viewport', () => {
    const roomIds = rawRooms.map((room) => room.id).sort();
    expect(Object.keys(ROOM_MAP_LAYOUT).sort()).toEqual(roomIds);
    for (const point of Object.values(ROOM_MAP_LAYOUT)) {
      expect(point.x).toBeGreaterThanOrEqual(20);
      expect(point.x).toBeLessThanOrEqual(460);
      expect(point.y).toBeGreaterThanOrEqual(40);
      expect(point.y).toBeLessThanOrEqual(220);
    }
  });

  it('连线不会横穿第三个房间的节点', () => {
    // 节点画成 12×8 的方块；连线压在别人身上会让地图读不出真实的连通关系。
    const crossings: string[] = [];
    for (const room of rawRooms) {
      for (const exit of room.exits) {
        const start = ROOM_MAP_LAYOUT[room.id];
        const end = ROOM_MAP_LAYOUT[exit.targetRoomId];
        if (!start || !end) continue;
        for (const [otherId, point] of Object.entries(ROOM_MAP_LAYOUT)) {
          if (otherId === room.id || otherId === exit.targetRoomId) continue;
          if (segmentHitsNode(start, end, point)) {
            crossings.push(`${room.id} → ${exit.targetRoomId} 穿过 ${otherId}`);
          }
        }
      }
    }
    expect(crossings).toEqual([]);
  });
});

function segmentHitsNode(
  start: MapPoint,
  end: MapPoint,
  node: MapPoint,
  halfWidth = 6,
  halfHeight = 4,
): boolean {
  const steps = 200;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;
    if (Math.abs(x - node.x) <= halfWidth && Math.abs(y - node.y) <= halfHeight) return true;
  }
  return false;
}
