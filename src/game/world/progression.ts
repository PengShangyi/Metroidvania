import type { AbilityState } from '../state/GameSession';
import type { GateRequirement, RoomDefinition } from './types';

export interface ProgressionResult {
  reachable: Set<string>;
  abilities: AbilityState;
}

export function simulateProgression(
  rooms: RoomDefinition[],
  startRoomId = 'vestibule_dock',
): ProgressionResult {
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const reachable = new Set<string>([startRoomId]);
  const abilities: AbilityState = { phaseDash: false, magneticGrip: false };

  let changed = true;
  while (changed) {
    changed = false;
    for (const roomId of [...reachable]) {
      const room = byId.get(roomId);
      if (!room) continue;
      for (const pickup of room.pickups) {
        // 拾取物自身的能力门与出口一样是硬性条件，RoomRuntime 也是这么判的。
        if (!meetsRequirement(pickup.requirement, abilities, false)) continue;
        if (pickup.type === 'phaseDash' && !abilities.phaseDash) {
          abilities.phaseDash = true;
          changed = true;
        }
        if (pickup.type === 'magneticGrip' && !abilities.magneticGrip) {
          abilities.magneticGrip = true;
          changed = true;
        }
      }
      for (const exit of room.exits) {
        if (
          meetsRequirement(exit.requirement, abilities, false) &&
          !reachable.has(exit.targetRoomId)
        ) {
          reachable.add(exit.targetRoomId);
          changed = true;
        }
      }
    }
  }

  return { reachable, abilities };
}

export function meetsRequirement(
  requirement: GateRequirement,
  abilities: AbilityState,
  bossDefeated: boolean,
): boolean {
  if (requirement === 'none') return true;
  if (requirement === 'phaseDash') return abilities.phaseDash;
  if (requirement === 'magneticGrip') return abilities.magneticGrip;
  if (requirement === 'dualAbility') return abilities.phaseDash && abilities.magneticGrip;
  return bossDefeated;
}
