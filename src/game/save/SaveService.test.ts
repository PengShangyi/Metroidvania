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

function validSaveData(): Record<string, unknown> {
  return {
    version: 1,
    currentRoomId: 'bioforge_intake',
    checkpointRoomId: 'bioforge_intake',
    checkpointSpawnId: 'from_causeway',
    health: 5,
    maxHealth: 5,
    abilities: { phaseDash: true, magneticGrip: false },
    visitedRooms: ['vestibule_dock', 'bioforge_intake'],
    collectedPickups: ['ability-phase-dash'],
    readLore: [],
    bossDefeated: false,
    elapsedMs: 12_000,
  };
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

  it('repairs impossible health values instead of trusting the file', () => {
    // 回归：maxHealth 只校验了 typeof number，0 会让重生把生命重置成 0 并陷入死循环。
    const storage = new MemoryStorage();
    const service = new SaveService(storage);
    storage.values.set(SAVE_KEY, JSON.stringify({ ...validSaveData(), maxHealth: 0, health: 9 }));

    const result = service.read();

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.session.maxHealth).toBe(5);
    expect(result.session.health).toBe(5);
  });

  it('clamps a health value above the recorded maximum', () => {
    const storage = new MemoryStorage();
    const service = new SaveService(storage);
    storage.values.set(SAVE_KEY, JSON.stringify({ ...validSaveData(), maxHealth: 6, health: 99 }));

    const result = service.read();

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.session.maxHealth).toBe(6);
    expect(result.session.health).toBe(6);
  });

  it('refuses to carry negative progress counters into the session', () => {
    const storage = new MemoryStorage();
    const service = new SaveService(storage);
    storage.values.set(
      SAVE_KEY,
      JSON.stringify({ ...validSaveData(), health: -4, elapsedMs: -1_000 }),
    );

    const result = service.read();

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.session.health).toBeGreaterThanOrEqual(1);
    expect(result.session.elapsedMs).toBe(0);
  });

  it('leaves a healthy save untouched', () => {
    const storage = new MemoryStorage();
    const service = new SaveService(storage);
    storage.values.set(SAVE_KEY, JSON.stringify({ ...validSaveData(), maxHealth: 6, health: 3 }));

    const result = service.read();

    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.session.maxHealth).toBe(6);
    expect(result.session.health).toBe(3);
    expect(result.session.elapsedMs).toBe(12_000);
  });

  it('survives denied storage writes', () => {
    const storage = new MemoryStorage();
    storage.shouldThrow = true;
    expect(new SaveService(storage).write(createNewSession())).toBe(false);
  });

  it('把指向不存在房间的存档判为损坏', () => {
    // 类型全对但房间不存在时，PlayScene.preload 的 rooms.get() 会抛异常直接白屏。
    for (const patch of [
      { currentRoomId: 'vestibule_atlantis' },
      { checkpointRoomId: 'vestibule_atlantis' },
    ]) {
      const storage = new MemoryStorage();
      storage.values.set(SAVE_KEY, JSON.stringify({ ...validSaveData(), ...patch }));
      expect(new SaveService(storage).read().status).toBe('corrupt');
    }
  });

  it('生成点对不上不算损坏：RoomRuntime 会退回房间首个生成点', () => {
    const storage = new MemoryStorage();
    storage.values.set(
      SAVE_KEY,
      JSON.stringify({ ...validSaveData(), checkpointSpawnId: 'from_nowhere' }),
    );
    expect(new SaveService(storage).read().status).toBe('valid');
  });
});
