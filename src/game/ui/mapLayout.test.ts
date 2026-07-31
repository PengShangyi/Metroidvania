import { describe, expect, it } from 'vitest';

import rawRooms from '../world/rooms.json';
import { ROOM_MAP_LAYOUT } from './mapLayout';

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
});
