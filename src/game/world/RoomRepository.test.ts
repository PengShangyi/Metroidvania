import { describe, expect, it } from 'vitest';

import { RoomRepository, validateRooms } from './RoomRepository';
import { meetsRequirement, simulateProgression } from './progression';

describe('room repository', () => {
  it('loads exactly seventeen connected rooms', () => {
    const repository = new RoomRepository();
    const result = simulateProgression(repository.all());

    expect(repository.all()).toHaveLength(17);
    expect(result.reachable.size).toBe(17);
    expect(result.abilities).toEqual({ phaseDash: true, magneticGrip: true });
  });

  it('rejects duplicate room ids', () => {
    const repository = new RoomRepository();
    const rooms = repository.all();
    expect(() => validateRooms([...rooms.slice(0, 16), rooms[0]])).toThrow(/重复/);
  });

  it('keeps the boss behind both permanent upgrades', () => {
    const repository = new RoomRepository();
    const result = simulateProgression(repository.all());

    expect(result.reachable.has('core_guardian')).toBe(true);
    expect(result.abilities.phaseDash && result.abilities.magneticGrip).toBe(true);
    expect(meetsRequirement('dualAbility', result.abilities, false)).toBe(true);
    expect(meetsRequirement('dualAbility', { phaseDash: true, magneticGrip: false }, false)).toBe(
      false,
    );
    expect(
      repository
        .get('reactor_threshold')
        .exits.find((exit) => exit.targetRoomId === 'core_guardian')?.requirement,
    ).toBe('dualAbility');
    expect(repository.get('core_guardian').exits[0]?.requirement).toBe('bossDefeated');
  });
});
