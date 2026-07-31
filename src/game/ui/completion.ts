import type { GameSessionState } from '../state/GameSession';

export const COMPLETION_TOTAL = {
  rooms: 17,
  pickups: 7,
  boss: 1,
} as const;

export function completionPercent(session: GameSessionState): number {
  const earned =
    Math.min(COMPLETION_TOTAL.rooms, session.visitedRooms.size) +
    Math.min(COMPLETION_TOTAL.pickups, session.collectedPickups.size) +
    Number(session.bossDefeated);
  const total = COMPLETION_TOTAL.rooms + COMPLETION_TOTAL.pickups + COMPLETION_TOTAL.boss;
  return Math.round((earned / total) * 100);
}
