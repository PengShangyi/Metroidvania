export interface AbilityState {
  phaseDash: boolean;
  magneticGrip: boolean;
}

export interface AccessibilitySettings {
  masterVolume: number;
  screenShake: boolean;
  strongFlashes: boolean;
}

export interface GameSessionState {
  currentRoomId: string;
  checkpointRoomId: string;
  checkpointSpawnId: string;
  health: number;
  maxHealth: number;
  abilities: AbilityState;
  visitedRooms: Set<string>;
  collectedPickups: Set<string>;
  readLore: Set<string>;
  bossDefeated: boolean;
  elapsedMs: number;
  settings: AccessibilitySettings;
}

export function createNewSession(): GameSessionState {
  return {
    currentRoomId: 'vestibule_dock',
    checkpointRoomId: 'vestibule_dock',
    checkpointSpawnId: 'start',
    health: 5,
    maxHealth: 5,
    abilities: {
      phaseDash: false,
      magneticGrip: false,
    },
    visitedRooms: new Set(['vestibule_dock']),
    collectedPickups: new Set(),
    readLore: new Set(),
    bossDefeated: false,
    elapsedMs: 0,
    settings: {
      masterVolume: 0.65,
      screenShake: true,
      strongFlashes: false,
    },
  };
}
