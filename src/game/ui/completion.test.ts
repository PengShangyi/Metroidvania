import { describe, expect, it } from 'vitest';

import { createNewSession } from '../state/GameSession';
import { RoomRepository } from '../world/RoomRepository';
import { COMPLETION_TOTAL, completionPercent } from './completion';

describe('completion statistics', () => {
  it('counts rooms, permanent pickups and the boss', () => {
    const session = createNewSession();
    expect(completionPercent(session)).toBe(4);
    session.visitedRooms = new Set(Array.from({ length: 17 }, (_, index) => `room-${index}`));
    session.collectedPickups = new Set(Array.from({ length: 7 }, (_, index) => `pickup-${index}`));
    session.bossDefeated = true;
    expect(completionPercent(session)).toBe(100);
  });

  it('计数与 rooms.json 一致，不各自漂移', () => {
    // HUD、结局页和地图都读这份常量；rooms.json 改了而这里没跟着改，
    // 玩家就会看到「探索 18/17」这种数字。
    const rooms = new RoomRepository().all();
    expect(COMPLETION_TOTAL.rooms).toBe(rooms.length);
    expect(COMPLETION_TOTAL.pickups).toBe(
      rooms.reduce((sum, room) => sum + room.pickups.length, 0),
    );
    expect(COMPLETION_TOTAL.lore).toBe(
      rooms.reduce(
        (sum, room) => sum + room.pickups.filter((pickup) => pickup.type === 'lore').length,
        0,
      ),
    );
  });
});
