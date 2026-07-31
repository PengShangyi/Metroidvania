export type BiomeId = 'vestibule' | 'bioforge' | 'reactor';
export type GateRequirement = 'none' | 'phaseDash' | 'magneticGrip' | 'bossDefeated';
export type EnemyType = 'crawler' | 'sentry' | 'turret' | 'spore';
export type PickupType = 'phaseDash' | 'magneticGrip' | 'healthCell' | 'lore';

export interface RectDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpawnDefinition {
  id: string;
  x: number;
  y: number;
}

export interface ExitDefinition extends RectDefinition {
  id: string;
  targetRoomId: string;
  targetSpawnId: string;
  requirement: GateRequirement;
}

export interface EnemySpawn {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
}

export interface PickupDefinition {
  id: string;
  type: PickupType;
  x: number;
  y: number;
  requirement: GateRequirement;
  text?: string;
}

export interface CheckpointDefinition {
  id: string;
  spawnId: string;
  x: number;
  y: number;
}

export interface RoomDefinition {
  id: string;
  name: string;
  biome: BiomeId;
  width: number;
  height: number;
  spawns: SpawnDefinition[];
  platforms: RectDefinition[];
  hazards: RectDefinition[];
  exits: ExitDefinition[];
  enemies: EnemySpawn[];
  pickups: PickupDefinition[];
  checkpoint?: CheckpointDefinition;
}
