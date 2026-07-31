import { describe, expect, it } from 'vitest';

import { createNewSession } from '../state/GameSession';
import { SAVE_KEY, SaveService, type StorageLike } from './SaveService';

class MemoryStorage implements StorageLike {
  public readonly values = new Map<string, string>();
  public shouldThrow = false;

  public getItem(key: string): string | null {
    if (this.shouldThrow) throw new Error('denied');
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    if (this.shouldThrow) throw new Error('quota');
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('save service', () => {
  it('round-trips permanent progress and set values', () => {
    const storage = new MemoryStorage();
    const service = new SaveService(storage);
    const session = createNewSession();
    session.currentRoomId = 'bioforge_intake';
    session.checkpointRoomId = 'bioforge_intake';
    session.abilities.phaseDash = true;
    session.abilities.magneticGrip = true;
    session.collectedPickups.add('ability-phase-dash');
    session.collectedPickups.add('ability-magnetic-grip');
    session.bossDefeated = true;
    session.visitedRooms.add('vestibule_gallery');

    expect(service.write(session)).toBe(true);
    const result = service.read();
    expect(result.status).toBe('valid');
    if (result.status === 'valid') {
      expect(result.session.abilities.phaseDash).toBe(true);
      expect(result.session.abilities.magneticGrip).toBe(true);
      expect(result.session.visitedRooms.has('vestibule_gallery')).toBe(true);
      expect(result.session.collectedPickups.has('ability-magnetic-grip')).toBe(true);
      expect(result.session.bossDefeated).toBe(true);
    }
  });

  it('rejects corrupt and unsupported saves without throwing', () => {
    const storage = new MemoryStorage();
    const service = new SaveService(storage);
    storage.values.set(SAVE_KEY, '{oops');
    expect(service.read().status).toBe('corrupt');
    storage.values.set(SAVE_KEY, JSON.stringify({ version: 9 }));
    expect(service.read().status).toBe('unsupported');
  });

  it('survives denied storage writes', () => {
    const storage = new MemoryStorage();
    storage.shouldThrow = true;
    expect(new SaveService(storage).write(createNewSession())).toBe(false);
  });
});
