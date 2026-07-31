import rawRooms from './rooms.json';
import type { EnemyType, GateRequirement, RoomDefinition } from './types';

const VALID_REQUIREMENTS = new Set<GateRequirement>([
  'none',
  'phaseDash',
  'magneticGrip',
  'dualAbility',
  'bossDefeated',
]);
const VALID_ENEMY_TYPES = new Set<EnemyType>(['crawler', 'sentry', 'turret', 'spore']);

export class RoomRepository {
  private readonly rooms: Map<string, RoomDefinition>;

  public constructor(definitions: RoomDefinition[] = rawRooms as RoomDefinition[]) {
    validateRooms(definitions);
    this.rooms = new Map(definitions.map((room) => [room.id, room]));
  }

  public get(id: string): RoomDefinition {
    const room = this.rooms.get(id);
    if (!room) throw new Error(`未知房间：${id}`);
    return room;
  }

  public all(): RoomDefinition[] {
    return [...this.rooms.values()];
  }
}

export function validateRooms(definitions: RoomDefinition[]): void {
  if (definitions.length !== 17)
    throw new Error(`世界必须包含 17 个房间，当前为 ${definitions.length}`);
  const ids = new Set<string>();
  const pickupIds = new Set<string>();
  const enemyIds = new Set<string>();

  for (const room of definitions) {
    if (!room.id || ids.has(room.id)) throw new Error(`房间 ID 重复或为空：${room.id}`);
    ids.add(room.id);
    if (room.width <= 0 || room.height <= 0) throw new Error(`房间尺寸非法：${room.id}`);
    if (room.spawns.length === 0) throw new Error(`房间缺少生成点：${room.id}`);

    for (const spawn of room.spawns)
      assertPointInRoom(room, spawn.x, spawn.y, `生成点 ${spawn.id}`);
    for (const exit of room.exits) {
      assertPointInRoom(room, exit.x, exit.y, `出口 ${exit.id}`);
      if (!VALID_REQUIREMENTS.has(exit.requirement)) throw new Error(`出口能力门非法：${exit.id}`);
    }
    for (const pickup of room.pickups) {
      if (pickupIds.has(pickup.id)) throw new Error(`拾取物 ID 重复：${pickup.id}`);
      pickupIds.add(pickup.id);
      assertPointInRoom(room, pickup.x, pickup.y, `拾取物 ${pickup.id}`);
    }
    for (const enemy of room.enemies) {
      if (!enemy.id || enemyIds.has(enemy.id)) throw new Error(`敌人 ID 重复或为空：${enemy.id}`);
      enemyIds.add(enemy.id);
      if (!VALID_ENEMY_TYPES.has(enemy.type)) throw new Error(`敌人类型非法：${enemy.id}`);
      if (enemy.variant !== undefined && enemy.variant !== 'shielded') {
        throw new Error(`敌人变体非法：${enemy.id}`);
      }
      if (enemy.variant === 'shielded' && enemy.type !== 'crawler') {
        throw new Error(`只有爬行体可使用护盾变体：${enemy.id}`);
      }
      assertPointInRoom(room, enemy.x, enemy.y, `敌人 ${enemy.id}`);
    }
    if (room.checkpoint && !room.spawns.some((spawn) => spawn.id === room.checkpoint?.spawnId)) {
      throw new Error(`终端 ${room.checkpoint.id} 指向未知生成点 ${room.checkpoint.spawnId}`);
    }
  }

  const byId = new Map(definitions.map((room) => [room.id, room]));
  for (const room of definitions) {
    for (const exit of room.exits) {
      const target = byId.get(exit.targetRoomId);
      if (!target) throw new Error(`出口 ${room.id}/${exit.id} 指向未知房间 ${exit.targetRoomId}`);
      if (!target.spawns.some((spawn) => spawn.id === exit.targetSpawnId)) {
        throw new Error(`出口 ${room.id}/${exit.id} 指向未知生成点 ${exit.targetSpawnId}`);
      }
      if (!target.exits.some((candidate) => candidate.targetRoomId === room.id)) {
        throw new Error(`出口 ${room.id}/${exit.id} 缺少返回路径`);
      }
    }
  }
}

function assertPointInRoom(room: RoomDefinition, x: number, y: number, label: string): void {
  if (x < 0 || y < 0 || x > room.width || y > room.height) {
    throw new Error(`${room.id} 的${label}位于房间边界外`);
  }
}
