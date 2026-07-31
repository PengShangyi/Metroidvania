import { describe, expect, it } from 'vitest';

import { createNewSession } from '../state/GameSession';
import { completionPercent } from './completion';

describe('completion statistics', () => {
  it('counts rooms, permanent pickups and the boss', () => {
    const session = createNewSession();
    expect(completionPercent(session)).toBe(4);
    session.visitedRooms = new Set(Array.from({ length: 17 }, (_, index) => `room-${index}`));
    session.collectedPickups = new Set(Array.from({ length: 7 }, (_, index) => `pickup-${index}`));
    session.bossDefeated = true;
    expect(completionPercent(session)).toBe(100);
  });
});
