import { describe, expect, it } from 'vitest';

import { RoomRepository } from '../world/RoomRepository';
import { createNewSession, type GameSessionState } from './GameSession';
import { resumeSession, sessionEntryPoint } from './resumePoint';

const repository = new RoomRepository();

function hasSpawn(roomId: string, spawnId: string): boolean {
  return repository.get(roomId).spawns.some((spawn) => spawn.id === spawnId);
}

function savedAt(roomId: string, spawnId: string, currentRoomId: string): GameSessionState {
  const saved = createNewSession();
  saved.checkpointRoomId = roomId;
  saved.checkpointSpawnId = spawnId;
  saved.currentRoomId = currentRoomId;
  return saved;
}

describe('resume point', () => {
  it('returns the player to the terminal room, not the room the save was written in', () => {
    const saved = savedAt('reactor_antechamber', 'from_spire', 'reactor_coreway');

    expect(sessionEntryPoint(resumeSession(saved))).toEqual({
      roomId: 'reactor_antechamber',
      spawnId: 'from_spire',
    });
  });

  it('never reuses a checkpoint spawn id inside a different room', () => {
    // 回归：磁巢也有名为 from_spire 的生成点，旧实现会把玩家静默传送到它的东门。
    expect(hasSpawn('bioforge_cradle', 'from_spire')).toBe(true);

    const saved = savedAt('reactor_antechamber', 'from_spire', 'bioforge_cradle');

    expect(sessionEntryPoint(resumeSession(saved)).roomId).toBe('reactor_antechamber');
  });

  it('resolves to a real spawn for every terminal in the world', () => {
    const terminals = repository.all().filter((room) => room.checkpoint);
    expect(terminals.length).toBeGreaterThan(0);

    for (const room of terminals) {
      const checkpoint = room.checkpoint;
      if (!checkpoint) continue;
      const saved = savedAt(room.id, checkpoint.spawnId, 'reactor_coreway');
      const entry = sessionEntryPoint(resumeSession(saved));

      expect(hasSpawn(entry.roomId, entry.spawnId)).toBe(true);
    }
  });

  it('keeps a fresh run at the opening terminal', () => {
    expect(sessionEntryPoint(createNewSession())).toEqual({
      roomId: 'vestibule_dock',
      spawnId: 'start',
    });
  });

  it('leaves post-game exploration in the room the player is standing in', () => {
    const session = savedAt('reactor_antechamber', 'from_spire', 'core_guardian');
    session.bossDefeated = true;

    // 结局界面回到游戏时不经过 resumeSession，房间必须保持在核心。
    expect(sessionEntryPoint(session)).toEqual({ roomId: 'core_guardian', spawnId: '' });
  });
});
