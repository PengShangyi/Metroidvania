import {
  createNewSession,
  type AccessibilitySettings,
  type GameSessionState,
} from '../state/GameSession';

export const SAVE_KEY = 'star-echo.save.v1';
export const SETTINGS_KEY = 'star-echo.settings.v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface SaveDataV1 {
  version: 1;
  currentRoomId: string;
  checkpointRoomId: string;
  checkpointSpawnId: string;
  health: number;
  maxHealth: number;
  abilities: { phaseDash: boolean; magneticGrip: boolean };
  visitedRooms: string[];
  collectedPickups: string[];
  readLore: string[];
  bossDefeated: boolean;
  elapsedMs: number;
}

export type SaveReadResult =
  | { status: 'empty' }
  | { status: 'corrupt' }
  | { status: 'unsupported' }
  | { status: 'valid'; session: GameSessionState };

export function createBrowserSaveService(): SaveService {
  try {
    return new SaveService(window.localStorage);
  } catch {
    return new SaveService({
      getItem: () => null,
      setItem: () => {
        throw new Error('storage unavailable');
      },
      removeItem: () => undefined,
    });
  }
}

export class SaveService {
  public constructor(private readonly storage: StorageLike) {}

  public read(): SaveReadResult {
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return { status: 'empty' };
      const parsed = JSON.parse(raw) as unknown;
      if (isRecord(parsed) && typeof parsed.version === 'number' && parsed.version !== 1) {
        return { status: 'unsupported' };
      }
      if (!isSaveDataV1(parsed)) return { status: 'corrupt' };
      return { status: 'valid', session: this.hydrate(parsed) };
    } catch {
      return { status: 'corrupt' };
    }
  }

  public write(session: GameSessionState): boolean {
    const data: SaveDataV1 = {
      version: 1,
      currentRoomId: session.currentRoomId,
      checkpointRoomId: session.checkpointRoomId,
      checkpointSpawnId: session.checkpointSpawnId,
      health: session.health,
      maxHealth: session.maxHealth,
      abilities: { ...session.abilities },
      visitedRooms: [...session.visitedRooms],
      collectedPickups: [...session.collectedPickups],
      readLore: [...session.readLore],
      bossDefeated: session.bossDefeated,
      elapsedMs: session.elapsedMs,
    };
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(data));
      this.writeSettings(session.settings);
      return true;
    } catch {
      return false;
    }
  }

  public erase(): boolean {
    try {
      this.storage.removeItem(SAVE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  public readSettings(): AccessibilitySettings {
    const defaults = createNewSession().settings;
    try {
      const raw = this.storage.getItem(SETTINGS_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw) as unknown;
      return isSettings(parsed) ? parsed : defaults;
    } catch {
      return defaults;
    }
  }

  public writeSettings(settings: AccessibilitySettings): boolean {
    try {
      this.storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      return true;
    } catch {
      return false;
    }
  }

  private hydrate(data: SaveDataV1): GameSessionState {
    const defaults = createNewSession();
    const maxHealth = positiveCount(data.maxHealth, defaults.maxHealth);
    return {
      currentRoomId: data.currentRoomId,
      checkpointRoomId: data.checkpointRoomId,
      checkpointSpawnId: data.checkpointSpawnId,
      health: Math.min(maxHealth, positiveCount(data.health, maxHealth)),
      maxHealth,
      abilities: { ...data.abilities },
      visitedRooms: new Set(data.visitedRooms),
      collectedPickups: new Set(data.collectedPickups),
      readLore: new Set(data.readLore),
      bossDefeated: data.bossDefeated,
      elapsedMs: Number.isFinite(data.elapsedMs) ? Math.max(0, data.elapsedMs) : 0,
      settings: this.readSettings(),
    };
  }
}

/** 存档只做了类型校验，数值区间必须在这里兜住，否则 0 上限会让重生陷入死循环。 */
function positiveCount(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const whole = Math.floor(value);
  return whole >= 1 ? whole : fallback;
}

function isSaveDataV1(value: unknown): value is SaveDataV1 {
  if (!isRecord(value) || value.version !== 1) return false;
  if (
    typeof value.currentRoomId !== 'string' ||
    typeof value.checkpointRoomId !== 'string' ||
    typeof value.checkpointSpawnId !== 'string' ||
    typeof value.health !== 'number' ||
    typeof value.maxHealth !== 'number' ||
    typeof value.elapsedMs !== 'number' ||
    typeof value.bossDefeated !== 'boolean'
  ) {
    return false;
  }
  if (!isRecord(value.abilities)) return false;
  if (
    typeof value.abilities.phaseDash !== 'boolean' ||
    typeof value.abilities.magneticGrip !== 'boolean'
  ) {
    return false;
  }
  return (
    isStringArray(value.visitedRooms) &&
    isStringArray(value.collectedPickups) &&
    isStringArray(value.readLore)
  );
}

function isSettings(value: unknown): value is AccessibilitySettings {
  return (
    isRecord(value) &&
    typeof value.masterVolume === 'number' &&
    value.masterVolume >= 0 &&
    value.masterVolume <= 1 &&
    typeof value.screenShake === 'boolean' &&
    typeof value.strongFlashes === 'boolean'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
